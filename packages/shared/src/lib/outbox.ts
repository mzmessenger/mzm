import type { QueueEventPayload, QueueEventType } from './queue.js'

export const OUTBOX_VERSION = 1 as const
export const MAX_QUEUE_BATCH_MESSAGES = 100
export const MAX_QUEUE_BATCH_BYTES = 256 * 1024
export const MAX_QUEUE_EVENT_BYTES = 120 * 1024

/** `satisfies Record<QueueEventType, true>` keeps this exhaustive as payloads are added. */
const QUEUE_EVENT_TYPES = {
  message: true,
  unread: true,
  reply: true,
  vote: true,
  removeUser: true
} as const satisfies Record<QueueEventType, true>

export const OUTBOX_STATUSES = ['pending', 'leased', 'dispatched'] as const
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number]

export type OutboxStateCounts = Record<OutboxStatus, number>

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

/**
 * The JSON form of an outbox row as returned by `/internal/outbox/v1/claim`.
 * Dates are serialized strings and `operationId` is a hex string, so this is
 * deliberately distinct from each service's Mongo document type.
 */
export type ClaimedOutboxEvent = QueueWireEvent & {
  _id: string
  status: OutboxStatus
  attempts: number
  lease?: { owner: string; expiresAt: string }
  publishedAt?: string
  dispatchedExpiresAt?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isQueueEventType(value: unknown): value is QueueEventType {
  return typeof value === 'string' && Object.hasOwn(QUEUE_EVENT_TYPES, value)
}

export function isOutboxStatus(value: unknown): value is OutboxStatus {
  return OUTBOX_STATUSES.includes(value as OutboxStatus)
}

export function isQueueWireEvent(value: unknown): value is QueueWireEvent {
  if (
    !isRecord(value) ||
    value.version !== OUTBOX_VERSION ||
    typeof value.eventId !== 'string' ||
    typeof value.operationId !== 'string' ||
    typeof value.eventIndex !== 'number' ||
    !Number.isSafeInteger(value.eventIndex) ||
    value.eventIndex < 0 ||
    (value.destination !== 'backend' && value.destination !== 'auth') ||
    !isQueueEventType(value.type) ||
    !isRecord(value.ordering) ||
    typeof value.ordering.key !== 'string' ||
    typeof value.ordering.revision !== 'number' ||
    !Number.isSafeInteger(value.ordering.revision) ||
    value.ordering.revision < 1 ||
    typeof value.createdAt !== 'string'
  ) {
    return false
  }
  return true
}

export function isClaimedOutboxEvent(
  value: unknown
): value is ClaimedOutboxEvent {
  if (!isRecord(value) || !isQueueWireEvent(value)) {
    return false
  }
  const row: Record<string, unknown> = value
  return (
    typeof row._id === 'string' &&
    isOutboxStatus(row.status) &&
    typeof row.attempts === 'number'
  )
}

export function emptyOutboxState(): OutboxStateCounts {
  return { pending: 0, leased: 0, dispatched: 0 }
}

export function isOutboxState(value: unknown): value is OutboxStateCounts {
  return (
    isRecord(value) &&
    OUTBOX_STATUSES.every((status) => typeof value[status] === 'number')
  )
}

/**
 * Folds `{ _id: status, count }` group rows into a count for every status.
 * Statuses absent from the rows stay at 0 and unknown ones are dropped, so the
 * result is always a complete `OutboxStateCounts`.
 */
export function foldOutboxState(
  rows: Iterable<{ _id: unknown; count: number }>
): OutboxStateCounts {
  const state = emptyOutboxState()
  for (const row of rows) {
    if (isOutboxStatus(row._id)) {
      state[row._id] = row.count
    }
  }
  return state
}

export function serializedEventBytes(event: QueueWireEvent) {
  return new TextEncoder().encode(JSON.stringify(event)).byteLength
}
