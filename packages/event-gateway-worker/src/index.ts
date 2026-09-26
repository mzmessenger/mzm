import {
  isClaimedOutboxEvent,
  isOutboxState,
  serializedEventBytes,
  MAX_QUEUE_BATCH_BYTES,
  MAX_QUEUE_BATCH_MESSAGES,
  MAX_QUEUE_EVENT_BYTES,
  type ClaimedOutboxEvent
} from 'mzm-shared/src/lib/outbox'

type GatewayEnv = {
  BACKEND_ORIGIN: string
  AUTH_ORIGIN: string
  GATEWAY_ORIGIN_SECRET: string
  EVENTS: {
    send(value: unknown): Promise<void>
    sendBatch(values: { body: unknown }[]): Promise<void>
  }
}

const idempotencyKey =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const authGetPaths = new Set([
  '/',
  '/authorize',
  '/auth/twitter',
  '/auth/twitter/callback',
  '/auth/github',
  '/auth/github/callback',
  '/auth/logout',
  '/auth/error'
])
const authPostPaths = new Set(['/auth/token'])
const authDeletePaths = new Set(['/auth/twitter', '/auth/github', '/auth/user'])

const apiGetPaths = new Set([
  '/api/socket',
  '/api/rooms',
  '/api/rooms/search',
  '/api/user/@me'
])
const apiPostPaths = new Set(['/api/socket', '/api/rooms', '/api/icon/user'])
const apiDeletePaths = new Set(['/api/rooms/enter'])
const apiPutPaths = new Set(['/api/user/@me'])

function isSocketMutation(request: Request) {
  const url = new URL(request.url)
  return (
    request.method === 'POST' &&
    isApiRequest(url) &&
    canonicalPublicPath(url) === '/api/socket'
  )
}

function isAuthRequest(url: URL) {
  return url.hostname === 'auth.mzm.dev' || url.hostname === 'auth.localhost'
}

function isApiRequest(url: URL) {
  return url.hostname === 'api.mzm.dev' || url.hostname === 'api.localhost'
}

function originFor(url: URL, env: GatewayEnv) {
  if (isAuthRequest(url)) return env.AUTH_ORIGIN
  if (isApiRequest(url)) return env.BACKEND_ORIGIN
  return null
}

function isPublicInternalPath(url: URL) {
  let pathname: string
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    return true
  }
  pathname = pathname
    .replaceAll('\\', '/')
    .replace(/\/{2,}/g, '/')
    .toLowerCase()
  return pathname === '/internal' || pathname.startsWith('/internal/')
}

function hasControlCharacter(value: string) {
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f))
      return true
  }
  return false
}

function canonicalPublicPath(url: URL) {
  const rawPathname = url.pathname
  if (rawPathname.includes('//')) return null

  let pathname: string
  try {
    pathname = decodeURIComponent(rawPathname)
  } catch {
    return null
  }

  const rawSegments = rawPathname.split('/')
  const decodedSegments = pathname.split('/')
  if (rawSegments.length !== decodedSegments.length) return null
  if (
    pathname.includes('\\') ||
    hasControlCharacter(pathname) ||
    decodedSegments.some((segment) => segment === '.' || segment === '..')
  )
    return null

  pathname = pathname.toLowerCase()
  if (pathname.length > 1 && pathname.endsWith('/'))
    pathname = pathname.slice(0, -1)
  return pathname
}

function isRoomUsersPath(pathname: string) {
  const segments = pathname.split('/')
  return (
    segments.length === 5 &&
    segments[1] === 'api' &&
    segments[2] === 'rooms' &&
    segments[3].length > 0 &&
    segments[4] === 'users'
  )
}

function isUserIconPath(pathname: string) {
  const segments = pathname.split('/')
  return (
    segments.length === 5 &&
    segments[1] === 'api' &&
    segments[2] === 'icon' &&
    segments[3] === 'user' &&
    segments[4].length > 0
  )
}

function isUserIconVersionPath(pathname: string) {
  const segments = pathname.split('/')
  return (
    segments.length === 6 &&
    segments[1] === 'api' &&
    segments[2] === 'icon' &&
    segments[3] === 'user' &&
    segments[4].length > 0 &&
    segments[5].length > 0
  )
}

function isRoomIconPath(pathname: string) {
  const segments = pathname.split('/')
  return (
    segments.length === 5 &&
    segments[1] === 'api' &&
    segments[2] === 'icon' &&
    segments[3] === 'rooms' &&
    segments[4].length > 0
  )
}

function isRoomIconVersionPath(pathname: string) {
  const segments = pathname.split('/')
  return (
    segments.length === 6 &&
    segments[1] === 'api' &&
    segments[2] === 'icon' &&
    segments[3] === 'rooms' &&
    segments[4].length > 0 &&
    segments[5].length > 0
  )
}

function hasEncodedStaticPathSegment(url: URL, pathname: string) {
  const rawSegments = url.pathname.split('/')
  const dynamicSegments = new Set<number>()
  if (isRoomUsersPath(pathname)) dynamicSegments.add(3)
  if (isUserIconPath(pathname) || isUserIconVersionPath(pathname))
    dynamicSegments.add(4)
  if (isUserIconVersionPath(pathname)) dynamicSegments.add(5)
  if (isRoomIconPath(pathname) || isRoomIconVersionPath(pathname))
    dynamicSegments.add(4)
  if (isRoomIconVersionPath(pathname)) dynamicSegments.add(5)

  for (let index = 0; index < rawSegments.length; index += 1) {
    if (rawSegments[index].includes('%') && !dynamicSegments.has(index))
      return true
  }
  return false
}

function isKnownAuthPath(method: string, pathname: string) {
  if (method === 'OPTIONS') {
    return (
      authGetPaths.has(pathname) ||
      authPostPaths.has(pathname) ||
      authDeletePaths.has(pathname)
    )
  }
  if (method === 'GET' || method === 'HEAD') {
    return authGetPaths.has(pathname)
  }
  if (method === 'POST') return authPostPaths.has(pathname)
  if (method === 'DELETE') return authDeletePaths.has(pathname)
  return false
}

function isKnownApiGetPath(pathname: string) {
  return (
    apiGetPaths.has(pathname) ||
    isRoomUsersPath(pathname) ||
    isUserIconPath(pathname) ||
    isUserIconVersionPath(pathname) ||
    isRoomIconVersionPath(pathname)
  )
}

function isKnownApiPath(method: string, pathname: string) {
  const isKnownPath =
    isKnownApiGetPath(pathname) ||
    apiPostPaths.has(pathname) ||
    apiDeletePaths.has(pathname) ||
    apiPutPaths.has(pathname) ||
    isRoomIconPath(pathname)

  if (method === 'OPTIONS') return isKnownPath
  if (method === 'GET') return isKnownApiGetPath(pathname)
  if (method === 'HEAD') return isKnownApiGetPath(pathname)
  if (method === 'POST') {
    return apiPostPaths.has(pathname) || isRoomIconPath(pathname)
  }
  if (method === 'DELETE') return apiDeletePaths.has(pathname)
  if (method === 'PUT') return apiPutPaths.has(pathname)
  return false
}

function isPublicRequestAllowed(request: Request, url: URL) {
  if (isPublicInternalPath(url)) return false

  const pathname = canonicalPublicPath(url)
  if (!pathname) return false
  if (hasEncodedStaticPathSegment(url, pathname)) return false
  if (isAuthRequest(url)) return isKnownAuthPath(request.method, pathname)
  if (isApiRequest(url)) return isKnownApiPath(request.method, pathname)
  return false
}

function createOriginRequest(request: Request, env: GatewayEnv) {
  const publicUrl = new URL(request.url)
  const originValue = originFor(publicUrl, env)
  if (!originValue) throw new Error('unsupported gateway host')
  const origin = new URL(originValue)
  const headers = new Headers(request.headers)
  for (const [name] of headers) {
    if (name.toLowerCase().startsWith('x-mzm-gateway-')) {
      headers.delete(name)
    }
  }
  if (
    isEventMutation(request) &&
    !idempotencyKey.test(headers.get('idempotency-key') ?? '')
  ) {
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
  return (
    isSocketMutation(request) ||
    (request.method === 'DELETE' &&
      isAuthRequest(url) &&
      canonicalPublicPath(url) === '/auth/user')
  )
}

export async function handleFetch(
  request: Request,
  env: GatewayEnv,
  fetcher: typeof fetch = fetch
) {
  const publicUrl = new URL(request.url)
  if (!isPublicRequestAllowed(request, publicUrl)) {
    return new Response('not found', { status: 404 })
  }
  const originRequest = createOriginRequest(request, env)
  const response = await fetcher(originRequest)
  const operationId = response.headers.get('x-mzm-operation-id')
  if (operationId && isEventMutation(request) && response.ok) {
    try {
      await publishOperation(
        operationId,
        originRequest.url,
        env,
        fetcher,
        5_000
      )
    } catch (error) {
      console.log(
        JSON.stringify({
          event: 'outbox_publish_failed',
          operationId,
          durationMs: 5_000,
          error: error instanceof Error ? error.message : 'unknown'
        })
      )
      return new Response('queue publication pending', {
        status: 503,
        headers: { 'retry-after': '1' }
      })
    }
  }
  const headers = new Headers(response.headers)
  headers.delete('x-mzm-gateway-authorization')
  return new Response(response.body, { status: response.status, headers })
}

async function publishOperation(
  operationId: string,
  originUrl: string,
  env: GatewayEnv,
  fetcher: typeof fetch,
  deadlineMs: number
) {
  const deadline = Date.now() + deadlineMs
  const owner = crypto.randomUUID()
  while (Date.now() < deadline) {
    const claim = await internal(
      originUrl,
      '/internal/outbox/v1/claim',
      { owner, operationId, limit: MAX_QUEUE_BATCH_MESSAGES },
      env,
      fetcher
    )
    if (!Array.isArray(claim) || claim.length === 0) {
      if (!operationId) return
      const state = await internal(
        originUrl,
        '/internal/outbox/v1/state',
        { operationId },
        env,
        fetcher
      )
      if (!isOutboxState(state))
        throw new Error('invalid outbox state response')
      if (state.pending === 0 && state.leased === 0) return
      continue
    }
    if (!claim.every(isClaimedOutboxEvent))
      throw new Error('invalid outbox claim response')
    const events = claim
    let bytes = 0
    const batch: ClaimedOutboxEvent[] = []
    for (const event of events) {
      const eventBytes = serializedEventBytes(event)
      if (
        eventBytes > MAX_QUEUE_EVENT_BYTES ||
        bytes + eventBytes > MAX_QUEUE_BATCH_BYTES
      )
        break
      batch.push(event)
      bytes += eventBytes
    }
    const deferred = events.slice(batch.length)
    if (deferred.length > 0) {
      const released = await internal(
        originUrl,
        '/internal/outbox/v1/release',
        {
          owner,
          events: deferred.map((event) => ({
            eventId: event._id,
            eventIndex: event.eventIndex
          }))
        },
        env,
        fetcher
      )
      if (released !== null) throw new Error('outbox release failed')
    }
    if (batch.length === 0) throw new Error('queue event too large')
    await env.EVENTS.sendBatch(batch.map((event) => ({ body: event })))
    const acknowledged = await internal(
      originUrl,
      '/internal/outbox/v1/ack',
      {
        owner,
        events: batch.map((event) => ({
          eventId: event._id,
          eventIndex: event.eventIndex
        }))
      },
      env,
      fetcher
    )
    if (acknowledged !== null) throw new Error('outbox acknowledgement failed')
  }
  throw new Error('gateway deadline exceeded')
}

async function internal(
  originUrl: string,
  path: string,
  body: unknown,
  env: GatewayEnv,
  fetcher: typeof fetch
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 2_000)
  try {
    const response = await fetcher(
      new Request(new URL(path, originUrl), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-mzm-gateway-authorization': `Bearer ${env.GATEWAY_ORIGIN_SECRET}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      })
    )
    if (!response.ok)
      throw new Error(`internal request failed: ${response.status}`)
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
      await Promise.all([
        publishOperation('', env.BACKEND_ORIGIN, env, fetch, 10_000),
        publishOperation('', env.AUTH_ORIGIN, env, fetch, 10_000)
      ])
    } catch (error) {
      console.log(
        JSON.stringify({
          event: 'outbox_relay_failed',
          durationMs: 10_000,
          error: error instanceof Error ? error.message : 'unknown'
        })
      )
    }
  }
}
