import type { QueueEventPayload, QueueEventType } from './queue.js'

export const OUTBOX_VERSION = 1 as const
export const MAX_QUEUE_BATCH_MESSAGES = 100
export const MAX_QUEUE_BATCH_BYTES = 256 * 1024
export const MAX_QUEUE_EVENT_BYTES = 120 * 1024

export type QueueWireEvent<T extends QueueEventType = QueueEventType> =
  T extends QueueEventType
    ? {
        version: typeof OUTBOX_VERSION
        eventId: string
        operationId: string
        eventIndex: number
        destination: 'backend' | 'auth'
        type: T
        payload: QueueEventPayload[T]
        ordering: { key: string; revision: number }
        createdAt: string
      }
    : never

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isQueueWireEvent(value: unknown): value is QueueWireEvent {
  if (!isRecord(value) || value.version !== OUTBOX_VERSION || typeof value.eventId !== 'string' || typeof value.operationId !== 'string' || typeof value.eventIndex !== 'number' || !Number.isSafeInteger(value.eventIndex) || value.eventIndex < 0 || (value.destination !== 'backend' && value.destination !== 'auth') || !['message', 'unread', 'reply', 'vote', 'removeUser'].includes(String(value.type)) || !isRecord(value.ordering) || typeof value.ordering.key !== 'string' || typeof value.ordering.revision !== 'number' || !Number.isSafeInteger(value.ordering.revision) || value.ordering.revision < 1 || typeof value.createdAt !== 'string') {
    return false
  }
  return true
}

export function serializedEventBytes(event: QueueWireEvent) {
  return new TextEncoder().encode(JSON.stringify(event)).byteLength
}
