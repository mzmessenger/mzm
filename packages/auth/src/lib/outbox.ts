import { ObjectId, type Filter, type MongoClient } from 'mongodb'
import { createHash } from 'node:crypto'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'

type Operation = { _id: ObjectId; subject: string; route: string; idempotencyKey: string; requestHash: string; response: { status: number; body: string }; outboxEventIds: string[]; createdAt: Date; expiresAt: Date }
type Outbox = Omit<QueueWireEvent, 'operationId'> & { _id: string; operationId: ObjectId; status: 'pending' | 'leased' | 'dispatched'; attempts: number; lease?: { owner: string; expiresAt: Date }; publishedAt?: Date; dispatchedExpiresAt?: Date }
type ProducerRevision = { _id: string; revision: number }

function outbox(db: MongoClient) {
  return db.db().collection<Outbox>('queue_outbox')
}

export async function initializeOutboxIndexes(db: MongoClient) {
  await Promise.all([
    db.db().collection<Operation>('idempotency_operations').createIndex({ subject: 1, route: 1, idempotencyKey: 1 }, { unique: true }),
    db.db().collection<Operation>('idempotency_operations').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    outbox(db).createIndex({ operationId: 1, eventIndex: 1 }, { unique: true })
  ])
}

export async function createRemoveUserOperation(db: MongoClient, subject: string, key: string) {
  const route = 'DELETE /auth/user'
  const requestHash = createHash('sha256').update(`${route}:${subject}`).digest('hex')
  const operations = db.db().collection<Operation>('idempotency_operations')
  const existing = await operations.findOne({ subject, route, idempotencyKey: key })
  if (existing) {
    if (existing.requestHash !== requestHash) throw new Error('idempotency key reuse conflict')
    return existing._id.toHexString()
  }
  const operationId = new ObjectId()
  const eventId = `${operationId.toHexString()}:0`
  const createdAt = new Date()
  await db.withSession(async (session) => {
    await session.withTransaction(async () => {
      const orderingKey = `user:${subject}`
      const revision = await db.db().collection<ProducerRevision>('queue_producer_revisions').findOneAndUpdate(
        { _id: orderingKey },
        { $inc: { revision: 1 } },
        { upsert: true, returnDocument: 'after', session }
      )
      if (!revision || typeof revision.revision !== 'number') {
        throw new Error('failed to advance producer revision')
      }
      const event: Outbox = { _id: eventId, version: 1, eventId, operationId, eventIndex: 0, destination: 'auth', type: 'removeUser', payload: { userId: subject }, ordering: { key: orderingKey, revision: revision.revision }, createdAt: createdAt.toISOString(), status: 'pending', attempts: 0 }
      await operations.insertOne({ _id: operationId, subject, route, idempotencyKey: key, requestHash, response: { status: 200, body: 'ok' }, outboxEventIds: [eventId], createdAt, expiresAt: new Date(createdAt.getTime() + 30 * 86400_000) }, { session })
      await outbox(db).insertOne(event, { session })
    })
  })
  return operationId.toHexString()
}

export async function claimOutbox(db: MongoClient, owner: string, operationId: string | undefined, limit: number) {
  const now = new Date()
  const filter: Filter<Outbox> = { ...(operationId ? { operationId: new ObjectId(operationId) } : {}), $or: [{ status: 'pending' }, { status: 'leased', 'lease.expiresAt': { $lte: now } }] }
  const rows = await outbox(db).find(filter).sort({ operationId: 1, eventIndex: 1 }).limit(limit).toArray()
  const result = []
  for (const row of rows) {
    const claimed = await outbox(db).findOneAndUpdate({ _id: row._id, $or: [{ status: 'pending' }, { status: 'leased', 'lease.expiresAt': { $lte: now } }] }, { $set: { status: 'leased', lease: { owner, expiresAt: new Date(now.getTime() + 120_000) } }, $inc: { attempts: 1 } }, { returnDocument: 'after' })
    if (claimed) result.push({ ...claimed, operationId: claimed.operationId.toHexString() })
  }
  return result
}

export async function acknowledgeOutbox(db: MongoClient, owner: string, events: { eventId: string; eventIndex: number }[]) {
  const result = await outbox(db).bulkWrite(events.map((event) => ({ updateOne: { filter: { _id: event.eventId, eventIndex: event.eventIndex, status: 'leased', 'lease.owner': owner, 'lease.expiresAt': { $gt: new Date() } }, update: { $set: { status: 'dispatched', publishedAt: new Date(), dispatchedExpiresAt: new Date(Date.now() + 30 * 86400_000) }, $unset: { lease: '' } } } })))
  return result.modifiedCount === events.length
}

export async function releaseOutbox(db: MongoClient, owner: string, events: { eventId: string; eventIndex: number }[]) {
  const result = await outbox(db).bulkWrite(events.map((event) => ({ updateOne: { filter: { _id: event.eventId, eventIndex: event.eventIndex, status: 'leased', 'lease.owner': owner }, update: { $set: { status: 'pending' }, $unset: { lease: '' } } } })))
  return result.modifiedCount === events.length
}

export async function outboxState(db: MongoClient, operationId: string) {
  const rows = await db.db().collection('queue_outbox').aggregate<{ _id: string; count: number }>([{ $match: { operationId: new ObjectId(operationId) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]).toArray()
  const state = { pending: 0, leased: 0, dispatched: 0 }
  for (const row of rows) {
    if (row._id === 'pending' || row._id === 'leased' || row._id === 'dispatched') state[row._id] = row.count
  }
  return state
}
