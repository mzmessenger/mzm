import { createHash } from 'node:crypto'
import { BadRequest, Conflict } from 'mzm-shared/src/lib/errors'
import { ObjectId, type ClientSession, type MongoClient } from 'mongodb'
import {
  foldOutboxState,
  isQueueWireEvent,
  MAX_QUEUE_EVENT_BYTES,
  serializedEventBytes,
  type QueueWireEvent
} from 'mzm-shared/src/lib/outbox'
import type {
  QueueEventPayload,
  QueueEventType
} from 'mzm-shared/src/lib/queue'
import {
  consumerReceipts,
  operations,
  outbox,
  producerRevisions,
  type OutboxEvent
} from './db/outbox.js'

/** How long a claim holds a row before another gateway may steal the lease. */
const OUTBOX_LEASE_MS = 120_000
/** How long acknowledged rows stay queryable before the TTL index drops them. */
const OUTBOX_DISPATCHED_RETENTION_MS = 30 * 86400_000

type OperationEvent = {
  [EventType in QueueEventType]: {
    type: EventType
    payload: QueueEventPayload[EventType]
    orderingKey: string
  }
}[QueueEventType]

function parseResponse<T>(value: string): T {
  return JSON.parse(value)
}

export async function createSocketOperation<T>({
  db,
  subject,
  idempotencyKey,
  request,
  run
}: {
  db: MongoClient
  subject: string
  idempotencyKey: string
  request: unknown
  run: (context: {
    session: ClientSession
    emit: (event: OperationEvent) => void
  }) => Promise<T>
}) {
  const route = 'POST /api/socket'
  const requestHash = createHash('sha256')
    .update(JSON.stringify(request))
    .digest('hex')
  const operationCollection = operations(db)
  const existing = await operationCollection.findOne({
    subject,
    route,
    idempotencyKey
  })
  if (existing) {
    if (existing.requestHash !== requestHash)
      throw new Conflict('idempotency key reuse conflict')
    return {
      operationId: existing._id.toHexString(),
      response: parseResponse<T>(existing.response)
    }
  }

  const operationId = new ObjectId()
  const events: OperationEvent[] = []
  let value: T | null = null
  try {
    await db.withSession(async (session) => {
      await session.withTransaction(async () => {
        await operationCollection.insertOne(
          {
            _id: operationId,
            subject,
            route,
            idempotencyKey,
            requestHash,
            response: 'null',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 30 * 86400_000)
          },
          { session }
        )
        const response = await run({
          session,
          emit(event) {
            events.push(event)
          }
        })
        value = response ?? null
        const wireEvents: OutboxEvent[] = []
        for (const [eventIndex, event] of events.entries()) {
          const revision = await producerRevisions(db).findOneAndUpdate(
            { _id: event.orderingKey },
            { $inc: { revision: 1 } },
            { upsert: true, returnDocument: 'after', session }
          )
          if (!revision || typeof revision.revision !== 'number') {
            throw new Error('failed to advance producer revision')
          }
          const eventId = `${operationId.toHexString()}:${eventIndex}`
          const queueEvent = {
            version: 1,
            eventId,
            operationId: operationId.toHexString(),
            eventIndex,
            destination: 'backend',
            type: event.type,
            payload: event.payload,
            ordering: { key: event.orderingKey, revision: revision.revision },
            createdAt: new Date().toISOString()
          }
          if (!isQueueWireEvent(queueEvent)) {
            throw new BadRequest({ reason: 'invalid queue event' })
          }
          if (serializedEventBytes(queueEvent) > MAX_QUEUE_EVENT_BYTES) {
            throw new BadRequest({ reason: 'queue event too large' })
          }
          wireEvents.push({
            ...queueEvent,
            _id: eventId,
            operationId,
            status: 'pending',
            attempts: 0
          })
        }
        if (wireEvents.length > 0)
          await outbox(db).insertMany(wireEvents, { session })
        await operationCollection.updateOne(
          { _id: operationId },
          { $set: { response: JSON.stringify(value) } },
          { session }
        )
      })
    })
  } catch (error) {
    const duplicate = await operationCollection.findOne({
      subject,
      route,
      idempotencyKey
    })
    if (duplicate) {
      if (duplicate.requestHash !== requestHash)
        throw new Conflict('idempotency key reuse conflict')
      return {
        operationId: duplicate._id.toHexString(),
        response: parseResponse<T>(duplicate.response)
      }
    }
    throw error
  }
  return { operationId: operationId.toHexString(), response: value }
}

/** Returns false only for duplicate deliveries. Receipt and mutation share one transaction. */
export async function acceptConsumerEvent(
  db: MongoClient,
  event: QueueWireEvent,
  mutate: (session: ClientSession) => Promise<void>
) {
  let accepted = false
  await db.withSession(async (session) => {
    await session.withTransaction(async () => {
      accepted = false
      const receipt = await consumerReceipts(db).updateOne(
        { _id: `backend:${event.eventId}` },
        {
          $setOnInsert: {
            consumerName: 'backend',
            eventId: event.eventId,
            processedAt: new Date()
          }
        },
        { upsert: true, session }
      )
      if (receipt.upsertedCount === 0) return
      await mutate(session)
      accepted = true
    })
  })
  return accepted
}

export async function claimOutbox({
  db,
  owner,
  operationId,
  limit
}: {
  db: MongoClient
  owner: string
  operationId?: string
  limit: number
}) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + OUTBOX_LEASE_MS)
  const operationFilter = operationId
    ? { operationId: new ObjectId(operationId) }
    : {}
  const candidates = await outbox(db)
    .find({
      ...operationFilter,
      $or: [
        { status: 'pending' },
        { status: 'leased', 'lease.expiresAt': { $lte: now } }
      ]
    })
    .sort({ operationId: 1, eventIndex: 1 })
    .limit(limit)
    .toArray()
  const claimed: OutboxEvent[] = []
  for (const event of candidates) {
    const result = await outbox(db).findOneAndUpdate(
      {
        _id: event._id,
        eventIndex: event.eventIndex,
        $or: [
          { status: 'pending' },
          { status: 'leased', 'lease.expiresAt': { $lte: now } }
        ]
      },
      {
        $set: { status: 'leased', lease: { owner, expiresAt } },
        $inc: { attempts: 1 }
      },
      { returnDocument: 'after' }
    )
    if (result) claimed.push(result)
  }
  return claimed
}

export async function acknowledgeOutbox({
  db,
  owner,
  events
}: {
  db: MongoClient
  owner: string
  events: { eventId: string; eventIndex: number }[]
}) {
  const now = new Date()
  const result = await outbox(db).bulkWrite(
    events.map((event) => ({
      updateOne: {
        filter: {
          _id: event.eventId,
          eventIndex: event.eventIndex,
          status: 'leased',
          'lease.owner': owner,
          'lease.expiresAt': { $gt: now }
        },
        update: {
          $set: {
            status: 'dispatched',
            publishedAt: now,
            dispatchedExpiresAt: new Date(
              now.getTime() + OUTBOX_DISPATCHED_RETENTION_MS
            )
          },
          $unset: { lease: '' }
        }
      }
    }))
  )
  return result.modifiedCount === events.length
}

export async function releaseOutbox({
  db,
  owner,
  events
}: {
  db: MongoClient
  owner: string
  events: { eventId: string; eventIndex: number }[]
}) {
  const result = await outbox(db).bulkWrite(
    events.map((event) => ({
      updateOne: {
        filter: {
          _id: event.eventId,
          eventIndex: event.eventIndex,
          status: 'leased',
          'lease.owner': owner
        },
        update: { $set: { status: 'pending' }, $unset: { lease: '' } }
      }
    }))
  )
  return result.modifiedCount === events.length
}

export async function outboxState(db: MongoClient, operationId: string) {
  const rows = await outbox(db)
    .aggregate<{ _id: OutboxEvent['status']; count: number }>([
      { $match: { operationId: new ObjectId(operationId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
    .toArray()
  return foldOutboxState(rows)
}
