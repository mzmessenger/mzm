import {
  isQueueWireEvent,
  type QueueWireEvent
} from 'mzm-shared/src/lib/outbox'

export type Env = {
  AUTH_SERVICE_URL: string
  BACKEND_SERVICE_URL: string
  QUEUE_CALLBACK_SECRET: string
  CF_ACCESS_AUD: string
  CF_ACCESS_TEAM_DOMAIN: string
  DLQ_ARCHIVE: {
    get(key: string): Promise<{ json(): Promise<unknown> } | null>
    put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<void>
  }
  EVENTS: { sendBatch(values: { body: unknown }[]): Promise<void> }
}

function callbackUrl(event: QueueWireEvent, env: Env) {
  if (event.destination === 'auth') {
    return new URL('/internal/queue/remove-user', env.AUTH_SERVICE_URL)
  }
  return new URL('/internal/queue', env.BACKEND_SERVICE_URL)
}

export async function handleFetch() {
  return new Response('not found', { status: 404 })
}

export async function archiveDlqEvent(event: QueueWireEvent, archive: Pick<Env['DLQ_ARCHIVE'], 'put'>) {
  await archive.put(event.eventId, JSON.stringify(event), {
    httpMetadata: { contentType: 'application/json' }
  })
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
}

function parseJson(value: Uint8Array) {
  return JSON.parse(new TextDecoder().decode(value))
}

function isJsonWebKey(value: unknown): value is JsonWebKey {
  return typeof value === 'object' && value !== null && typeof Reflect.get(value, 'kty') === 'string'
}

export async function validateAccessJwt(token: string, env: Env, fetcher: typeof fetch = fetch) {
  const [encodedHeader, encodedPayload, encodedSignature, ...extra] = token.split('.')
  if (!encodedHeader || !encodedPayload || !encodedSignature || extra.length !== 0) return false
  try {
    const header = parseJson(decodeBase64Url(encodedHeader))
    const payload = parseJson(decodeBase64Url(encodedPayload))
    if (!header || typeof header !== 'object' || Reflect.get(header, 'alg') !== 'RS256' || typeof Reflect.get(header, 'kid') !== 'string') return false
    if (!payload || typeof payload !== 'object') return false
    const audience = Reflect.get(payload, 'aud')
    const audiences = typeof audience === 'string' ? [audience] : Array.isArray(audience) ? audience : []
    const now = Math.floor(Date.now() / 1000)
    if (!audiences.includes(env.CF_ACCESS_AUD) || Reflect.get(payload, 'iss') !== `https://${env.CF_ACCESS_TEAM_DOMAIN}` || typeof Reflect.get(payload, 'exp') !== 'number' || Reflect.get(payload, 'exp') <= now || (typeof Reflect.get(payload, 'nbf') === 'number' && Reflect.get(payload, 'nbf') > now)) return false
    const certificates = await fetcher(`https://${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`)
    if (!certificates.ok) return false
    const body: unknown = await certificates.json()
    if (!body || typeof body !== 'object' || !Array.isArray(Reflect.get(body, 'keys'))) return false
    const key = Reflect.get(body, 'keys').find((candidate) => candidate && typeof candidate === 'object' && Reflect.get(candidate, 'kid') === Reflect.get(header, 'kid'))
    if (!isJsonWebKey(key)) return false
    const publicKey = await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, decodeBase64Url(encodedSignature), new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`))
  } catch {
    return false
  }
}

export async function replayDlq(request: Request, env: Env, fetcher: typeof fetch = fetch) {
  const assertion = request.headers.get('cf-access-jwt-assertion')
  if (!assertion || !await validateAccessJwt(assertion, env, fetcher)) return new Response('Cloudflare Access authentication required', { status: 401 })
  const body: unknown = await request.json()
  if (!body || typeof body !== 'object') return new Response('invalid replay request', { status: 400 })
  const eventIds: unknown = Reflect.get(body, 'eventIds')
  if (!Array.isArray(eventIds) || !eventIds.every((id) => typeof id === 'string')) return new Response('invalid replay request', { status: 400 })
  if (eventIds.length === 0 || eventIds.length > 100) return new Response('invalid replay request', { status: 400 })
  const events = await Promise.all(eventIds.map(async (eventId) => {
    const saved = await env.DLQ_ARCHIVE.get(eventId)
    if (!saved) return undefined
    return parseQueueEvent(await saved.json())
  }))
  const replayable = events.filter((event) => event !== undefined)
  if (replayable.length > 0) await env.EVENTS.sendBatch(replayable.map((event) => ({ body: event })))
  return Response.json({ replayed: replayable.length })
}

export async function dispatchEvent(
  event: QueueWireEvent,
  env: Env,
  fetcher: typeof fetch = fetch
) {
  const response = await fetcher(
    new Request(callbackUrl(event, env), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.QUEUE_CALLBACK_SECRET}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(event)
    })
  )
  if (!response.ok) {
    throw new Error(`queue callback failed: ${response.status}`)
  }
}

function parseQueueEvent(value: unknown) {
  if (!isQueueWireEvent(value)) {
    throw new Error('invalid queue event')
  }
  return value
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/internal/dlq/replay') return await replayDlq(request, env)
    return await handleFetch()
  },
  async queue(batch: MessageBatch<unknown>, env: Env) {
    if (batch.queue === 'mzm-events-dlq') {
      for (const message of batch.messages) {
        await archiveDlqEvent(parseQueueEvent(message.body), env.DLQ_ARCHIVE)
        message.ack()
      }
      return
    }
    for (const message of batch.messages) {
      await dispatchEvent(parseQueueEvent(message.body), env)
      message.ack()
    }
  }
} satisfies ExportedHandler<Env, unknown>
