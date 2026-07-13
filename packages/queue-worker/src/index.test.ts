import { expect, test, vi } from 'vitest'
import type { QueueEvent } from 'mzm-shared/src/lib/queue'
import { dispatchEvent, handleFetch } from './index.js'

function createEnv() {
  return {
    EVENTS: { send: vi.fn<Queue<QueueEvent>['send']>().mockResolvedValue() },
    AUTH_SERVICE_URL: 'http://127.0.0.1:3002',
    BACKEND_SERVICE_URL: 'http://127.0.0.1:3001',
    QUEUE_SECRET: 'secret'
  }
}

const event: QueueEvent<'unread'> = {
  id: 'event-id',
  type: 'unread',
  payload: {
    roomId: '0123456789abcdef01234567',
    messageId: 'abcdef0123456789abcdef01'
  },
  createdAt: '2026-07-13T00:00:00.000Z'
}

test('認証済みイベントをQueueへpublishする', async () => {
  const env = createEnv()
  const response = await handleFetch(
    new Request('http://worker/events', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
      body: JSON.stringify(event)
    }),
    env
  )

  expect(response.status).toBe(202)
  expect(env.EVENTS.send).toHaveBeenCalledWith(event)
})

test('認証されていないpublishを拒否する', async () => {
  const response = await handleFetch(
    new Request('http://worker/events', { method: 'POST' }),
    createEnv()
  )
  expect(response.status).toBe(401)
})

test('不正なイベントをQueueへpublishしない', async () => {
  const env = createEnv()
  const response = await handleFetch(
    new Request('http://worker/events', {
      method: 'POST',
      headers: { authorization: 'Bearer secret' },
      body: JSON.stringify({
        id: 'invalid-event',
        type: 'unread',
        payload: { roomId: 'not-an-object-id', messageId: 'also-invalid' },
        createdAt: new Date().toISOString()
      })
    }),
    env
  )

  expect(response.status).toBe(400)
  expect(env.EVENTS.send).not.toHaveBeenCalled()
})

test('通常イベントをbackendへ送る', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 204 }))
  await dispatchEvent(event, createEnv(), fetcher)

  expect(fetcher).toHaveBeenCalledOnce()
  expect(fetcher.mock.calls[0][0].toString()).toBe(
    'http://127.0.0.1:3001/internal/queue'
  )
})

test('ユーザー削除をauthの後にbackendへ送る', async () => {
  const removeEvent: QueueEvent<'removeUser'> = {
    ...event,
    type: 'removeUser',
    payload: { userId: 'user' }
  }
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 204 }))
  await dispatchEvent(removeEvent, createEnv(), fetcher)

  expect(fetcher.mock.calls.map(([url]) => url.toString())).toStrictEqual([
    'http://127.0.0.1:3002/internal/queue/remove-user',
    'http://127.0.0.1:3001/internal/queue'
  ])
})
