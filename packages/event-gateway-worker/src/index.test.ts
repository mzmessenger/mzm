import { expect, test, vi } from 'vitest'
import { MAX_QUEUE_EVENT_BYTES } from 'mzm-shared/src/lib/outbox'
import worker, { handleFetch } from './index.js'

function createEnv() {
  return {
    BACKEND_ORIGIN: 'https://backend.internal',
    AUTH_ORIGIN: 'https://auth.internal',
    GATEWAY_ORIGIN_SECRET: 'gateway-secret',
    EVENTS: { send: vi.fn(), sendBatch: vi.fn() }
  }
}

test('POST /api/socket assigns an idempotency key without consuming its body', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'))
  await handleFetch(
    new Request('http://api.localhost:8788/api/socket', {
      method: 'POST',
      body: 'streamed-body'
    }),
    createEnv(),
    fetcher
  )

  expect(fetcher).toHaveBeenCalledOnce()
  const forwarded = new Request(fetcher.mock.calls[0][0])
  expect(forwarded.headers.get('idempotency-key')).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
  expect(await forwarded.text()).toBe('streamed-body')
})

test('DELETE /auth/user assigns an idempotency key and forwards the gateway credential', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'))
  const response = await handleFetch(
    new Request('https://auth.mzm.dev/auth/user', { method: 'DELETE' }),
    createEnv(),
    fetcher
  )

  expect(response.status).toBe(200)
  expect(fetcher).toHaveBeenCalledOnce()
  const forwarded = new Request(fetcher.mock.calls[0][0])
  expect(forwarded.url).toBe('https://auth.internal/auth/user')
  expect(forwarded.headers.get('idempotency-key')).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
  expect(forwarded.headers.get('x-mzm-gateway-authorization')).toBe(
    'Bearer gateway-secret'
  )
})

test('local auth requests use the auth origin', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'))
  await handleFetch(
    new Request('http://auth.localhost:8788/auth/user', { method: 'DELETE' }),
    createEnv(),
    fetcher
  )

  const forwarded = new Request(fetcher.mock.calls[0][0])
  expect(forwarded.url).toBe('https://auth.internal/auth/user')
  expect(forwarded.headers.get('idempotency-key')).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
})

test('worker fetch uses the platform fetch implementation', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'))
  vi.stubGlobal('fetch', fetcher)

  const response = await worker.fetch(
    new Request('http://api.localhost:8788/api/rooms'),
    createEnv()
  )

  expect(response.status).toBe(200)
  expect(fetcher).toHaveBeenCalledOnce()
  vi.unstubAllGlobals()
})

test.each([
  '/internal/outbox/v1/claim',
  '/INTERNAL/outbox/v1/claim',
  '/%69nternal/outbox/v1/claim'
])('public requests cannot reach the internal origin path %s', async (path) => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('origin reached'))

  const response = await handleFetch(
    new Request(`https://api.mzm.dev${path}`, { method: 'POST', body: '{}' }),
    createEnv(),
    fetcher
  )

  expect(response.status).toBe(404)
  expect(fetcher).not.toHaveBeenCalled()
})

test('POST /api/socket replaces a malformed idempotency key', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'))
  await handleFetch(
    new Request('https://api.mzm.dev/api/socket', {
      method: 'POST',
      headers: {
        'Idempotency-Key': 'malformed'
      },
      body: 'streamed-body'
    }),
    createEnv(),
    fetcher
  )

  const forwarded = new Request(fetcher.mock.calls[0][0])
  expect(forwarded.headers.get('idempotency-key')).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  )
})

test('gateway proxies the socket body and removes forged internal headers', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('ok'))
  const response = await handleFetch(
    new Request('https://api.mzm.dev/api/socket?x=1', {
      method: 'POST',
      headers: {
        'Idempotency-Key': 'a2b0d5c8-4473-4c36-8a9e-d08a52e4dbab',
        'X-MZM-Gateway-Authorization': 'Bearer forged'
      },
      body: 'streamed-body'
    }),
    createEnv(),
    fetcher
  )

  expect(await response.text()).toBe('ok')
  expect(fetcher).toHaveBeenCalledOnce()
  const forwarded = new Request(fetcher.mock.calls[0][0])
  expect(forwarded.url).toBe('https://backend.internal/api/socket?x=1')
  expect(forwarded.headers.get('x-mzm-gateway-authorization')).toBe(
    'Bearer gateway-secret'
  )
  expect(await forwarded.text()).toBe('streamed-body')
})

function claimedOutboxEventFixture(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    _id: '0123456789abcdef01234567:0',
    status: 'leased',
    attempts: 1,
    eventIndex: 0,
    version: 1,
    eventId: '0123456789abcdef01234567:0',
    operationId: '0123456789abcdef01234567',
    destination: 'backend',
    type: 'message',
    payload: {},
    ordering: { key: 'message:abc', revision: 1 },
    createdAt: '2026-07-14T00:00:00.000Z',
    ...overrides
  }
}

test('a failed queue send turns a committed mutation into a retryable 503', async () => {
  const env = createEnv()
  env.EVENTS.sendBatch.mockRejectedValueOnce(new Error('queue unavailable'))
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response('committed', {
        headers: { 'x-mzm-operation-id': '0123456789abcdef01234567' }
      })
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify([claimedOutboxEventFixture()]))
    )

  const response = await handleFetch(
    new Request('https://api.mzm.dev/api/socket', {
      method: 'POST',
      headers: {
        'Idempotency-Key': 'a2b0d5c8-4473-4c36-8a9e-d08a52e4dbab'
      },
      body: 'streamed-body'
    }),
    env,
    fetcher
  )

  expect(env.EVENTS.sendBatch).toHaveBeenCalledOnce()
  expect(response.status).toBe(503)
  expect(response.headers.get('retry-after')).toBe('1')
})

test('a committed mutation is published to the queue and acknowledged', async () => {
  const env = createEnv()
  env.EVENTS.sendBatch.mockResolvedValueOnce(undefined)
  const claimedEvent = claimedOutboxEventFixture()
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response('committed', {
        headers: { 'x-mzm-operation-id': '0123456789abcdef01234567' }
      })
    )
    .mockResolvedValueOnce(new Response(JSON.stringify([claimedEvent])))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(JSON.stringify([])))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ pending: 0, leased: 0, dispatched: 1 }))
    )

  const response = await handleFetch(
    new Request('https://api.mzm.dev/api/socket', {
      method: 'POST',
      headers: {
        'Idempotency-Key': 'a2b0d5c8-4473-4c36-8a9e-d08a52e4dbab'
      },
      body: 'streamed-body'
    }),
    env,
    fetcher
  )

  expect(env.EVENTS.sendBatch).toHaveBeenCalledOnce()
  expect(env.EVENTS.sendBatch).toHaveBeenCalledWith([{ body: claimedEvent }])
  const ackRequest = new Request(fetcher.mock.calls[2][0])
  expect(new URL(ackRequest.url).pathname).toBe('/internal/outbox/v1/ack')
  expect(await ackRequest.json()).toMatchObject({
    events: [{ eventId: claimedEvent._id, eventIndex: claimedEvent.eventIndex }]
  })
  expect(await response.text()).toBe('committed')
  expect(response.status).toBe(200)
})

test('claimed events outside the byte-limited batch are released', async () => {
  const env = createEnv()
  env.EVENTS.sendBatch.mockResolvedValueOnce(undefined)
  const publishedEvent = claimedOutboxEventFixture()
  const deferredEvent = claimedOutboxEventFixture({
    _id: '0123456789abcdef01234568:1',
    eventId: '0123456789abcdef01234568:1',
    eventIndex: 1,
    payload: { body: 'x'.repeat(MAX_QUEUE_EVENT_BYTES) }
  })
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response('committed', {
        headers: { 'x-mzm-operation-id': '0123456789abcdef01234567' }
      })
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify([publishedEvent, deferredEvent]))
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(JSON.stringify([])))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ pending: 0, leased: 0, dispatched: 1 }))
    )

  const response = await handleFetch(
    new Request('https://api.mzm.dev/api/socket', {
      method: 'POST',
      headers: {
        'Idempotency-Key': 'a2b0d5c8-4473-4c36-8a9e-d08a52e4dbab'
      },
      body: 'streamed-body'
    }),
    env,
    fetcher
  )

  expect(env.EVENTS.sendBatch).toHaveBeenCalledWith([{ body: publishedEvent }])
  const releaseRequest = new Request(fetcher.mock.calls[2][0])
  expect(new URL(releaseRequest.url).pathname).toBe(
    '/internal/outbox/v1/release'
  )
  expect(await releaseRequest.json()).toMatchObject({
    events: [
      { eventId: deferredEvent._id, eventIndex: deferredEvent.eventIndex }
    ]
  })
  expect(response.status).toBe(200)
})
