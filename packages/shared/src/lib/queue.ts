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

/** An in-process event collector.  It deliberately has no transport concern. */
export type EventPublisher = {
  publish<T extends QueueEventType>(
    type: T,
    payload: QueueEventPayload[T]
  ): Promise<void>
}
