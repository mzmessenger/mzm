import type { ToClientType } from '../type/socket.js'

export type QueueEventPayload = {
  message: ToClientType
  unread: { roomId: string; messageId: string }
  reply: { roomId: string; userId: string }
  vote: { messageId: string }
  removeUser: { userId: string }
}

export type QueueEventType = keyof QueueEventPayload

export type QueueEvent<T extends QueueEventType = QueueEventType> =
  T extends QueueEventType
    ? {
        id: string
        type: T
        payload: QueueEventPayload[T]
        createdAt: string
      }
    : never

export type EventPublisher = {
  publish<T extends QueueEventType>(
    type: T,
    payload: QueueEventPayload[T]
  ): Promise<void>
}

type QueueConfigInput = {
  nodeEnv: string | undefined
  url: string | undefined
  secret: string | undefined
}

export function resolveQueueConfig({ nodeEnv, url, secret }: QueueConfigInput) {
  if (nodeEnv === 'production' && (!url || !secret)) {
    throw new Error('QUEUE_URL and QUEUE_SECRET are required in production')
  }
  return {
    url: url ?? 'http://127.0.0.1:8787',
    secret: secret ?? 'local-queue-secret'
  }
}

export function createHttpEventPublisher({
  url,
  secret,
  fetcher = fetch
}: {
  url: string
  secret: string
  fetcher?: typeof fetch
}): EventPublisher {
  return {
    async publish(type, payload) {
      const event = {
        id: crypto.randomUUID(),
        type,
        payload,
        createdAt: new Date().toISOString()
      }
      const response = await fetcher(new URL('/events', url), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(event)
      })
      if (!response.ok) {
        throw new Error(`queue publish failed: ${response.status}`)
      }
    }
  }
}
