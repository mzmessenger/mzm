import type { QueueEventPayload, QueueEventType } from './queue.js'
import { TO_CLIENT_CMD, type MessageType, type ToClientType } from '../type/socket.js'

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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === 'string'
}

function isNullableString(value: unknown) {
  return value === null || typeof value === 'string'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isVoteAnswer(value: unknown) {
  return (
    isRecord(value) &&
    isFiniteNumber(value.answer) &&
    isFiniteNumber(value.index) &&
    typeof value.userId === 'string' &&
    typeof value.userAccount === 'string' &&
    isNullableString(value.icon)
  )
}

function isMessageVote(value: unknown) {
  return (
    isRecord(value) &&
    Array.isArray(value.questions) &&
    value.questions.every(
      (question) => isRecord(question) && typeof question.text === 'string'
    ) &&
    Array.isArray(value.answers) &&
    value.answers.every(isVoteAnswer) &&
    (value.status === 0 || value.status === 1)
  )
}

function isMessage(value: unknown): value is MessageType {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.userId === 'string' &&
    typeof value.message === 'string' &&
    isFiniteNumber(value.iine) &&
    typeof value.updated === 'boolean' &&
    typeof value.removed === 'boolean' &&
    typeof value.createdAt === 'string' &&
    isNullableString(value.updatedAt) &&
    typeof value.userAccount === 'string' &&
    isNullableString(value.icon) &&
    (value.vote === undefined || isMessageVote(value.vote))
  )
}

function isRoomSummary(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    isNullableString(value.iconUrl) &&
    isFiniteNumber(value.unread) &&
    isFiniteNumber(value.replied) &&
    (value.status === 'open' || value.status === 'close')
  )
}

function isToClientPayload(value: unknown): value is ToClientType {
  if (!isRecord(value)) return false
  switch (value.cmd) {
    case TO_CLIENT_CMD.CLIENT_RELOAD:
      return isOptionalString(value.user)
    case TO_CLIENT_CMD.SOCKET_CONNECTION:
      return typeof value.user === 'string' && typeof value.signup === 'boolean'
    case TO_CLIENT_CMD.ROOMS_GET:
      return (
        typeof value.user === 'string' &&
        Array.isArray(value.rooms) &&
        value.rooms.every(isRoomSummary) &&
        isStringArray(value.roomOrder)
      )
    case TO_CLIENT_CMD.MESSAGE_RECEIVE:
      return (
        isNullableString(value.user) &&
        isMessage(value.message) &&
        typeof value.room === 'string'
      )
    case TO_CLIENT_CMD.MESSAGES_ROOM:
      return (
        typeof value.user === 'string' &&
        Array.isArray(value.messages) &&
        value.messages.every(isMessage) &&
        typeof value.room === 'string' &&
        typeof value.existHistory === 'boolean'
      )
    case TO_CLIENT_CMD.ROOMS_ENTER_SUCCESS:
      return (
        typeof value.user === 'string' &&
        typeof value.id === 'string' &&
        typeof value.name === 'string' &&
        isNullableString(value.iconUrl) &&
        typeof value.description === 'string'
      )
    case TO_CLIENT_CMD.ROOMS_ENTER_FAIL:
      return (
        typeof value.user === 'string' &&
        isNullableString(value.id) &&
        isNullableString(value.name) &&
        isNullableString(value.reason)
      )
    case TO_CLIENT_CMD.MESSAGE_MODIFY:
    case TO_CLIENT_CMD.MESSAGE_REMOVE:
      return (
        typeof value.user === 'string' &&
        isMessage(value.message) &&
        typeof value.room === 'string'
      )
    case TO_CLIENT_CMD.ROOMS_READ:
      return typeof value.user === 'string' && typeof value.room === 'string'
    case TO_CLIENT_CMD.MESSAGE_IINE:
      return (
        isOptionalString(value.user) &&
        typeof value.room === 'string' &&
        typeof value.id === 'string' &&
        isFiniteNumber(value.iine)
      )
    case TO_CLIENT_CMD.ROOMS_SORT_SUCCESS:
      return typeof value.user === 'string' && isStringArray(value.roomOrder)
    case TO_CLIENT_CMD.VOTE_ANSWERS:
      return (
        isOptionalString(value.user) &&
        typeof value.messageId === 'string' &&
        Array.isArray(value.answers) &&
        value.answers.every(isVoteAnswer)
      )
    case TO_CLIENT_CMD.ROOMS_UPDATE_DESCRIPTION:
      return (
        isOptionalString(value.user) &&
        typeof value.roomId === 'string' &&
        typeof value.descrioption === 'string'
      )
    default:
      return false
  }
}

function isQueueEventPayload(type: QueueEventType, payload: unknown): boolean {
  if (!isRecord(payload)) return false
  switch (type) {
    case 'message':
      return isToClientPayload(payload)
    case 'unread':
      return typeof payload.roomId === 'string' && typeof payload.messageId === 'string'
    case 'reply':
      return typeof payload.roomId === 'string' && typeof payload.userId === 'string'
    case 'vote':
      return typeof payload.messageId === 'string'
    case 'removeUser':
      return typeof payload.userId === 'string'
    default:
      return false
  }
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
  return isQueueEventPayload(value.type, value.payload)
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
