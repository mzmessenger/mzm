import {
  isClaimedOutboxEvent,
  isOutboxState,
  serializedEventBytes,
  MAX_QUEUE_BATCH_BYTES,
  MAX_QUEUE_BATCH_MESSAGES,
  MAX_QUEUE_EVENT_BYTES,
  type ClaimedOutboxEvent
} from 'mzm-shared/src/lib/outbox'
import {
  publicRoutes,
  type PublicRoute
} from 'mzm-shared/src/api/public-routes'

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

function isSocketMutation(request: Request, url: URL, rawPathname: string) {
  return (
    request.method === 'POST' &&
    isApiRequest(url) &&
    canonicalPublicPath(rawPathname) === '/api/socket'
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

function rawPathnameFromRequestUrl(rawUrl: string) {
  const authorityStart = rawUrl.indexOf('://') + 3
  const pathStart = rawUrl.indexOf('/', authorityStart)
  if (pathStart === -1) return '/'

  const queryStart = rawUrl.indexOf('?', pathStart)
  const fragmentStart = rawUrl.indexOf('#', pathStart)
  let pathEnd = rawUrl.length
  if (queryStart !== -1) pathEnd = Math.min(pathEnd, queryStart)
  if (fragmentStart !== -1) pathEnd = Math.min(pathEnd, fragmentStart)
  return rawUrl.slice(pathStart, pathEnd) || '/'
}

function isPublicInternalPath(rawPathname: string) {
  let pathname: string
  try {
    pathname = decodeURIComponent(rawPathname)
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

function isDotPathSegment(segment: string) {
  const normalized = segment.toLowerCase()
  return (
    normalized === '.' ||
    normalized === '..' ||
    normalized === '%2e' ||
    normalized === '.%2e' ||
    normalized === '%2e.' ||
    normalized === '%2e%2e'
  )
}

function canonicalPublicPath(rawPathname: string) {
  if (rawPathname.includes('//')) return null
  if (rawPathname.split('/').some((segment) => isDotPathSegment(segment)))
    return null

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

function matchesRoutePattern(pattern: string, pathname: string) {
  const patternSegments = pattern.split('/')
  const pathSegments = pathname.split('/')
  if (patternSegments.length !== pathSegments.length) return false
  return patternSegments.every((segment, index) => {
    if (segment.startsWith(':')) return pathSegments[index].length > 0
    return segment === pathSegments[index]
  })
}

function findRoute(routes: readonly PublicRoute[], pathname: string) {
  return routes.find((route) => {
    return matchesRoutePattern(route.path, pathname)
  })
}

function findPublicRoute(url: URL, pathname: string) {
  if (isAuthRequest(url)) return findRoute(publicRoutes.auth, pathname)
  if (isApiRequest(url)) return findRoute(publicRoutes.api, pathname)
  return undefined
}

function hasEncodedStaticPathSegment(rawPathname: string, routePath: string) {
  const rawSegments = rawPathname.split('/')
  const routeSegments = routePath.split('/')
  return rawSegments.some((segment, index) => {
    return segment.includes('%') && !routeSegments[index].startsWith(':')
  })
}

function isRouteMethodAllowed(method: string, methods: readonly string[]) {
  if (method === 'OPTIONS') return methods.length > 0
  if (method === 'HEAD')
    return methods.some((routeMethod) => routeMethod === 'GET')
  return methods.some((routeMethod) => routeMethod === method)
}

function isPublicRequestAllowed(
  request: Request,
  url: URL,
  rawPathname: string
) {
  if (isPublicInternalPath(rawPathname)) return false

  const pathname = canonicalPublicPath(rawPathname)
  if (!pathname) return false
  const route = findPublicRoute(url, pathname)
  if (!route) return false
  if (hasEncodedStaticPathSegment(rawPathname, route.path)) return false
  return isRouteMethodAllowed(request.method, route.methods)
}

function createOriginRequest(
  request: Request,
  env: GatewayEnv,
  publicUrl: URL,
  rawPathname: string
) {
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
    isEventMutation(request, publicUrl, rawPathname) &&
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
  return new Request(new URL(`${rawPathname}${publicUrl.search}`, origin), init)
}

function isEventMutation(request: Request, url: URL, rawPathname: string) {
  return (
    isSocketMutation(request, url, rawPathname) ||
    (request.method === 'DELETE' &&
      isAuthRequest(url) &&
      canonicalPublicPath(rawPathname) === '/auth/user')
  )
}

export async function handleFetch(
  request: Request,
  env: GatewayEnv,
  fetcher: typeof fetch = fetch
) {
  const publicUrl = new URL(request.url)
  const rawPathname = rawPathnameFromRequestUrl(request.url)
  if (!isPublicRequestAllowed(request, publicUrl, rawPathname)) {
    return new Response('not found', { status: 404 })
  }
  const originRequest = createOriginRequest(
    request,
    env,
    publicUrl,
    rawPathname
  )
  const response = await fetcher(originRequest)
  const operationId = response.headers.get('x-mzm-operation-id')
  if (
    operationId &&
    isEventMutation(request, publicUrl, rawPathname) &&
    response.ok
  ) {
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
