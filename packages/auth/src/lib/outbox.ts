import { ObjectId, type MongoClient } from 'mongodb'
import { createHash } from 'node:crypto'
import { foldOutboxState } from 'mzm-shared/src/lib/outbox'

/** How long a claim holds a row before another gateway may steal the lease. */
const OUTBOX_LEASE_MS = 120_000
/** How long acknowledged rows stay queryable before the TTL index drops them. */
const OUTBOX_DISPATCHED_RETENTION_MS = 30 * 86400_000
import {
  operations,
  outbox,
  producerRevisions,
  type OutboxEvent,
  type OutboxFilter
} from './db/outbox.js'

export async function createRemoveUserOperation(
  db: MongoClient,
  subject: string,
  key: string
) {
  const route = 'DELETE /auth/user'
  const requestHash = createHash('sha256')
    .update(`${route}:${subject}`)
    .digest('hex')
  const operationCollection = operations(db)
  const existing = await operationCollection.findOne({
    subject,
    route,
    idempotencyKey: key
  })
  if (existing) {
    if (existing.requestHash !== requestHash)
      throw new Error('idempotency key reuse conflict')
    return existing._id.toHexString()
  }
  const operationId = new ObjectId()
  const eventId = `${operationId.toHexString()}:0`
  const createdAt = new Date()
  await db.withSession(async (session) => {
    await session.withTransaction(async () => {
      const orderingKey = `user:${subject}`
      const revision = await producerRevisions(db).findOneAndUpdate(
        { _id: orderingKey },
        { $inc: { revision: 1 } },
        { upsert: true, returnDocument: 'after', session }
      )
      if (!revision || typeof revision.revision !== 'number') {
        throw new Error('failed to advance producer revision')
      }
      const event: OutboxEvent = {
        _id: eventId,
        version: 1,
        eventId,
        operationId,
        eventIndex: 0,
        destination: 'auth',
        type: 'removeUser',
        payload: { userId: subject },
        ordering: { key: orderingKey, revision: revision.revision },
        createdAt: createdAt.toISOString(),
        status: 'pending',
        attempts: 0
      }
      await operationCollection.insertOne(
        {
          _id: operationId,
          subject,
          route,
          idempotencyKey: key,
          requestHash,
          response: { status: 200, body: 'ok' },
          outboxEventIds: [eventId],
          createdAt,
          expiresAt: new Date(createdAt.getTime() + 30 * 86400_000)
        },
        { session }
      )
      await outbox(db).insertOne(event, { session })
    })
  })
  return operationId.toHexString()
}

export async function claimOutbox(
  db: MongoClient,
  owner: string,
  operationId: string | undefined,
  limit: number
) {
  const now = new Date()
  const filter: OutboxFilter = {
    ...(operationId ? { operationId: new ObjectId(operationId) } : {}),
    $or: [
      { status: 'pending' },
      { status: 'leased', 'lease.expiresAt': { $lte: now } }
    ]
  }
  const rows = await outbox(db)
    .find(filter)
    .sort({ operationId: 1, eventIndex: 1 })
    .limit(limit)
    .toArray()
  const result = []
  for (const row of rows) {
    const claimed = await outbox(db).findOneAndUpdate(
      {
        _id: row._id,
        $or: [
          { status: 'pending' },
          { status: 'leased', 'lease.expiresAt': { $lte: now } }
        ]
      },
      {
        $set: {
          status: 'leased',
          lease: {
            owner,
            expiresAt: new Date(now.getTime() + OUTBOX_LEASE_MS)
          }
        },
        $inc: { attempts: 1 }
      },
      { returnDocument: 'after' }
    )
    if (claimed)
      result.push({
        ...claimed,
        operationId: claimed.operationId.toHexString()
      })
  }
  return result
}

export async function acknowledgeOutbox(
  db: MongoClient,
  owner: string,
  events: { eventId: string; eventIndex: number }[]
) {
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

export async function releaseOutbox(
  db: MongoClient,
  owner: string,
  events: { eventId: string; eventIndex: number }[]
) {
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
    .aggregate<{ _id: string; count: number }>([
      { $match: { operationId: new ObjectId(operationId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
    .toArray()
  return foldOutboxState(rows)
}
