import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'

type GatewayEnv = {
  BACKEND_ORIGIN: string
  AUTH_ORIGIN: string
  GATEWAY_ORIGIN_SECRET: string
  EVENTS: { send(value: unknown): Promise<void>; sendBatch(values: { body: unknown }[]): Promise<void> }
}

type ClaimedEvent = QueueWireEvent & {
  _id: string
  status: 'pending' | 'leased' | 'dispatched'
  attempts: number
  lease?: { owner: string; expiresAt: string }
  publishedAt?: string
  dispatchedExpiresAt?: string
}

type OutboxState = { pending: number; leased: number; dispatched: number }

function isQueueEventType(value: unknown): value is 'message' | 'unread' | 'reply' | 'vote' | 'removeUser' {
  return value === 'message' || value === 'unread' || value === 'reply' || value === 'vote' || value === 'removeUser'
}

const idempotencyKey =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isSocketMutation(request: Request) {
  const url = new URL(request.url)
  return request.method === 'POST' && (url.hostname === 'api.mzm.dev' || url.hostname === 'api.localhost') && url.pathname === '/api/socket'
}

function isAuthRequest(url: URL) {
  return url.hostname === 'auth.mzm.dev' || url.hostname === 'auth.localhost'
}

function originFor(url: URL, env: GatewayEnv) {
  return isAuthRequest(url) ? env.AUTH_ORIGIN : env.BACKEND_ORIGIN
}

function isPublicInternalPath(url: URL) {
  let pathname: string
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    return true
  }
  pathname = pathname.replaceAll('\\', '/').replace(/\/{2,}/g, '/').toLowerCase()
  return pathname === '/internal' || pathname.startsWith('/internal/')
}

function createOriginRequest(request: Request, env: GatewayEnv) {
  const publicUrl = new URL(request.url)
  const origin = new URL(originFor(publicUrl, env))
  const headers = new Headers(request.headers)
  for (const [name] of headers) {
    if (name.toLowerCase().startsWith('x-mzm-gateway-')) {
      headers.delete(name)
    }
  }
  if (isEventMutation(request) && !idempotencyKey.test(headers.get('idempotency-key') ?? '')) {
    headers.set('idempotency-key', crypto.randomUUID())
  }
  headers.set('host', origin.host)
  headers.set('x-forwarded-host', publicUrl.host)
  headers.set('x-forwarded-proto', publicUrl.protocol.slice(0, -1))
  headers.set(
    'x-mzm-gateway-authorization',
    `Bearer ${env.GATEWAY_ORIGIN_SECRET}`
  )
  const init = {
    method: request.method,
    headers,
    body: request.body,
    signal: request.signal,
    redirect: 'manual' as const,
    duplex: 'half'
  }
  return new Request(
    new URL(`${publicUrl.pathname}${publicUrl.search}`, origin),
    init
  )
}

function isEventMutation(request: Request) {
  const url = new URL(request.url)
  return isSocketMutation(request) || (request.method === 'DELETE' && isAuthRequest(url) && url.pathname === '/auth/user')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isClaimedEvent(value: unknown): value is ClaimedEvent {
  return isRecord(value) && typeof value._id === 'string' && typeof value.eventId === 'string' && typeof value.operationId === 'string' && typeof value.eventIndex === 'number' && Number.isSafeInteger(value.eventIndex) && value.eventIndex >= 0 && typeof value.version === 'number' && value.version === 1 && (value.destination === 'backend' || value.destination === 'auth') && isQueueEventType(value.type) && isRecord(value.ordering) && typeof value.ordering.key === 'string' && typeof value.ordering.revision === 'number' && Number.isSafeInteger(value.ordering.revision) && value.ordering.revision >= 1 && typeof value.createdAt === 'string' && typeof value.status === 'string' && typeof value.attempts === 'number'
}

function isOutboxState(value: unknown): value is OutboxState {
  return isRecord(value) && typeof value.pending === 'number' && typeof value.leased === 'number' && typeof value.dispatched === 'number'
}

export async function handleFetch(
  request: Request,
  env: GatewayEnv,
  fetcher: typeof fetch = fetch
) {
  if (isPublicInternalPath(new URL(request.url))) {
    return new Response('not found', { status: 404 })
  }
  const originRequest = createOriginRequest(request, env)
  const response = await fetcher(originRequest)
  const operationId = response.headers.get('x-mzm-operation-id')
  if (operationId && isEventMutation(request) && response.ok) {
    try {
      await publishOperation(operationId, originRequest.url, env, fetcher, 5_000)
    } catch (error) {
      console.log(JSON.stringify({ event: 'outbox_publish_failed', operationId, durationMs: 5_000, error: error instanceof Error ? error.message : 'unknown' }))
      return new Response('queue publication pending', { status: 503, headers: { 'retry-after': '1' } })
    }
  }
  const headers = new Headers(response.headers)
  headers.delete('x-mzm-gateway-authorization')
  return new Response(response.body, { status: response.status, headers })
}

async function publishOperation(operationId: string, originUrl: string, env: GatewayEnv, fetcher: typeof fetch, deadlineMs: number) {
  const deadline = Date.now() + deadlineMs
  const owner = crypto.randomUUID()
  while (Date.now() < deadline) {
    const claim = await internal(originUrl, '/internal/outbox/v1/claim', { owner, operationId, limit: 100 }, env, fetcher)
    if (!Array.isArray(claim) || claim.length === 0) {
      if (!operationId) return
      const state = await internal(originUrl, '/internal/outbox/v1/state', { operationId }, env, fetcher)
      if (!isOutboxState(state)) throw new Error('invalid outbox state response')
      if (state.pending === 0 && state.leased === 0) return
      continue
    }
    if (!claim.every(isClaimedEvent)) throw new Error('invalid outbox claim response')
    const events = claim
    let bytes = 0
    const batch: ClaimedEvent[] = []
    for (const event of events) {
      const eventBytes = new TextEncoder().encode(JSON.stringify(event)).byteLength
      if (eventBytes > 120 * 1024 || bytes + eventBytes > 256 * 1024) break
      batch.push(event)
      bytes += eventBytes
    }
    if (batch.length === 0) throw new Error('queue event too large')
    await env.EVENTS.sendBatch(batch.map((event) => ({ body: event })))
    const acknowledged = await internal(originUrl, '/internal/outbox/v1/ack', { owner, events: batch.map((event) => ({ eventId: event._id, eventIndex: event.eventIndex })) }, env, fetcher)
    if (acknowledged !== null) throw new Error('outbox acknowledgement failed')
  }
  throw new Error('gateway deadline exceeded')
}

async function internal(originUrl: string, path: string, body: unknown, env: GatewayEnv, fetcher: typeof fetch): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2_000)
  try {
    const response = await fetcher(new Request(new URL(path, originUrl), { method: 'POST', headers: { 'content-type': 'application/json', 'x-mzm-gateway-authorization': `Bearer ${env.GATEWAY_ORIGIN_SECRET}` }, body: JSON.stringify(body), signal: controller.signal }))
    if (!response.ok) throw new Error(`internal request failed: ${response.status}`)
    if (response.status === 204) return null
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

export default {
  fetch(request: Request, env: GatewayEnv) {
    return handleFetch(request, env)
  },
  async scheduled(_: unknown, env: GatewayEnv) {
    try {
      await Promise.all([publishOperation('', env.BACKEND_ORIGIN, env, fetch, 10_000), publishOperation('', env.AUTH_ORIGIN, env, fetch, 10_000)])
    } catch (error) {
      console.log(JSON.stringify({ event: 'outbox_relay_failed', durationMs: 10_000, error: error instanceof Error ? error.message : 'unknown' }))
    }
  }
}
