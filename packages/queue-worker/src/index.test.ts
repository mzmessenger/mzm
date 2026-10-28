import { expect, test, vi } from 'vitest'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'
import worker, {
  archiveDlqEvent,
  dispatchEvent,
  replayDlq,
  type Env
} from './index.js'

function createEnv(): Env {
  return {
    AUTH_SERVICE_URL: 'http://127.0.0.1:3002',
    BACKEND_SERVICE_URL: 'http://127.0.0.1:3001',
    QUEUE_CALLBACK_SECRET: 'secret',
    CF_ACCESS_AUD: 'queue-replay',
    CF_ACCESS_TEAM_DOMAIN: 'mzm.cloudflareaccess.com'
    ,
    DLQ_ARCHIVE: createArchive(),
    EVENTS: { sendBatch: vi.fn() }
  }
}

function createArchive(): Pick<Env['DLQ_ARCHIVE'], 'get' | 'put'> {
  const values = new Map<string, string>()
  return {
    get: vi.fn(async (key: string) => {
      const value = values.get(key)
      return value ? { json: async () => JSON.parse(value) } : null
    }),
    put: vi.fn(async (key: string, value: string) => { values.set(key, value) })
  }
}

const event: QueueWireEvent = {
  version: 1,
  eventId: '0123456789abcdef01234567:0',
  operationId: '0123456789abcdef01234567',
  eventIndex: 0,
  destination: 'backend',
  type: 'unread',
  payload: {
    roomId: '0123456789abcdef01234567',
    messageId: 'abcdef0123456789abcdef01'
  },
  ordering: { key: 'room:0123456789abcdef01234567', revision: 1 },
  createdAt: '2026-07-14T00:00:00.000Z'
}

test('does not expose a public Queue HTTP producer endpoint', async () => {
  const response = await worker.fetch(
    new Request('http://worker/events', { method: 'POST' }),
    createEnv()
  )

  expect(response.status).toBe(404)
})

test('delivers the original versioned event to its destination callback', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 204 }))

  await dispatchEvent(event, createEnv(), fetcher)

  expect(fetcher).toHaveBeenCalledOnce()
  const [request] = fetcher.mock.calls[0]
  expect(request).toBeInstanceOf(Request)
  if (!(request instanceof Request)) throw new Error('expected Request instance')
  expect(request.url).toBe('http://127.0.0.1:3001/internal/queue')
  expect(request.headers.get('authorization')).toBe('Bearer secret')
  expect(await request.json()).toStrictEqual(event)
})

test('rejects a callback response so Cloudflare retries the queue message', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('unavailable', { status: 503 }))

  await expect(dispatchEvent(event, createEnv(), fetcher)).rejects.toThrow(
    'queue callback failed: 503'
  )
})

test('archives malformed DLQ bodies before acknowledging their messages', async () => {
  const env = createEnv()
  const rawBody = { version: 'unexpected', payload: 'retain-me' }
  const ack = vi.fn()

  await worker.queue(
    {
      queue: 'mzm-events-dlq',
      messages: [
        {
          id: 'queue-message-id',
          timestamp: new Date(),
          body: rawBody,
          attempts: 6,
          ack,
          retry: vi.fn()
        }
      ],
      metadata: { metrics: { backlogCount: 1, backlogBytes: 40 } },
      ackAll: vi.fn(),
      retryAll: vi.fn()
    },
    env
  )

  expect(env.DLQ_ARCHIVE.put).toHaveBeenCalledWith(
    'queue-message-id',
    JSON.stringify(rawBody),
    { httpMetadata: { contentType: 'application/json' } }
  )
  expect(ack).toHaveBeenCalledOnce()
})

test('archives DLQ events as JSON objects', async () => {
  const archive = createArchive()
  await archiveDlqEvent(event.eventId, event, archive)
  expect(archive.put).toHaveBeenCalledWith(event.eventId, JSON.stringify(event), { httpMetadata: { contentType: 'application/json' } })
})

function base64Url(value: string) {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function accessAssertion() {
  const generatedKey = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
  if (!('privateKey' in generatedKey)) throw new Error('expected RSA key pair')
  const pair = generatedKey
  const header = base64Url(JSON.stringify({ alg: 'RS256', kid: 'test-key' }))
  const payload = base64Url(JSON.stringify({ iss: 'https://mzm.cloudflareaccess.com', aud: 'queue-replay', exp: Math.floor(Date.now() / 1000) + 60 }))
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${header}.${payload}`))
  const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey)
  return { token: `${header}.${payload}.${base64Url(String.fromCharCode(...new Uint8Array(signature)))}`, publicKey: { ...publicKey, kid: 'test-key' } }
}

test('rejects malformed archived bodies during replay without sending a batch', async () => {
  const archive = createArchive()
  await archive.put('queue-message-id', JSON.stringify({ invalid: true }))
  const env: Env = {
    ...createEnv(),
    DLQ_ARCHIVE: archive,
    EVENTS: { sendBatch: vi.fn() }
  }
  const assertion = await accessAssertion()
  const response = await replayDlq(
    new Request('https://queue.mzm.dev/internal/dlq/replay', {
      method: 'POST',
      headers: { 'cf-access-jwt-assertion': assertion.token },
      body: JSON.stringify({ archiveIds: ['queue-message-id'] })
    }),
    env,
    vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ keys: [assertion.publicKey] })
    )
  )

  expect(response.status).toBe(400)
  expect(await response.text()).toBe('invalid archived event')
  expect(env.EVENTS.sendBatch).not.toHaveBeenCalled()
})

test('rejects an archived event with an invalid type-specific payload', async () => {
  const archive = createArchive()
  await archive.put(
    'queue-message-id',
    JSON.stringify({ ...event, payload: { roomId: '0123456789abcdef01234567' } })
  )
  const env: Env = {
    ...createEnv(),
    DLQ_ARCHIVE: archive,
    EVENTS: { sendBatch: vi.fn() }
  }
  const assertion = await accessAssertion()
  const response = await replayDlq(
    new Request('https://queue.mzm.dev/internal/dlq/replay', {
      method: 'POST',
      headers: { 'cf-access-jwt-assertion': assertion.token },
      body: JSON.stringify({ archiveIds: ['queue-message-id'] })
    }),
    env,
    vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ keys: [assertion.publicKey] })
    )
  )

  expect(response.status).toBe(400)
  expect(await response.text()).toBe('invalid archived event')
  expect(env.EVENTS.sendBatch).not.toHaveBeenCalled()
})

test('replays archived DLQ events only after a verified Cloudflare Access assertion', async () => {
  const archive = createArchive()
  await archiveDlqEvent(event.eventId, event, archive)
  const env: Env = { ...createEnv(), DLQ_ARCHIVE: archive, EVENTS: { sendBatch: vi.fn() } }
  const denied = await replayDlq(new Request('https://queue.mzm.dev/internal/dlq/replay', { method: 'POST', body: JSON.stringify({ eventIds: [event.eventId] }) }), env)
  expect(denied.status).toBe(401)
  const assertion = await accessAssertion()
  const allowed = await replayDlq(new Request('https://queue.mzm.dev/internal/dlq/replay', { method: 'POST', headers: { 'cf-access-jwt-assertion': assertion.token }, body: JSON.stringify({ eventIds: [event.eventId] }) }), env, vi.fn<typeof fetch>().mockResolvedValue(Response.json({ keys: [assertion.publicKey] })))
  expect(allowed.status).toBe(200)
  expect(env.EVENTS.sendBatch).toHaveBeenCalledWith([{ body: event }])
})
