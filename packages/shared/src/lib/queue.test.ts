import { expect, test, vi } from 'vitest'
import { createHttpEventPublisher, resolveQueueConfig } from './queue.js'

test('productionではQueue設定を必須にする', () => {
  expect(() =>
    resolveQueueConfig({
      nodeEnv: 'production',
      url: undefined,
      secret: undefined
    })
  ).toThrow('QUEUE_URL and QUEUE_SECRET are required in production')
})

test('ローカル開発ではQueue設定の既定値を使う', () => {
  expect(
    resolveQueueConfig({
      nodeEnv: undefined,
      url: undefined,
      secret: undefined
    })
  ).toStrictEqual({
    url: 'http://127.0.0.1:8787',
    secret: 'local-queue-secret'
  })
})

test('認証付きでCloudflare Queue producerへイベントを送る', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 202 }))
  const publisher = createHttpEventPublisher({
    url: 'http://127.0.0.1:8787',
    secret: 'local-secret',
    fetcher
  })

  await publisher.publish('unread', { roomId: 'room', messageId: 'message' })

  expect(fetcher).toHaveBeenCalledOnce()
  const [requestUrl, init] = fetcher.mock.calls[0]
  expect(requestUrl.toString()).toBe('http://127.0.0.1:8787/events')
  expect(init?.headers).toStrictEqual({
    authorization: 'Bearer local-secret',
    'content-type': 'application/json'
  })
  expect(JSON.parse(String(init?.body))).toMatchObject({
    type: 'unread',
    payload: { roomId: 'room', messageId: 'message' }
  })
})

test('producerが失敗した場合は例外にする', async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 503 }))
  const publisher = createHttpEventPublisher({
    url: 'http://127.0.0.1:8787',
    secret: 'local-secret',
    fetcher
  })

  await expect(
    publisher.publish('reply', { roomId: 'room', userId: 'user' })
  ).rejects.toThrow('queue publish failed: 503')
})
