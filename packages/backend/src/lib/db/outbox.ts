import { ObjectId, type Collection, type MongoClient } from 'mongodb'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'

export type OutboxEvent = Omit<QueueWireEvent, 'operationId'> & {
  _id: string
  operationId: ObjectId
  status: 'pending' | 'leased' | 'dispatched'
  attempts: number
  lease?: { owner: string; expiresAt: Date }
  publishedAt?: Date
  dispatchedExpiresAt?: Date
}

export type ConsumerReceipt = {
  _id: string
  consumerName: 'backend' | 'auth'
  eventId: string
  processedAt: Date
}
export type ConsumerRevision = { _id: string; revision: number }
export type ProducerRevision = { _id: string; revision: number }
export type Operation = {
  _id: ObjectId
  subject: string
  route: string
  idempotencyKey: string
  requestHash: string
  response: string
  createdAt: Date
  expiresAt: Date
}

export function outbox(db: MongoClient) {
  return db.db().collection<OutboxEvent>('queue_outbox')
}

export function consumerReceipts(db: MongoClient) {
  return db.db().collection<ConsumerReceipt>('queue_consumer_receipts')
}

export function consumerRevisions(db: MongoClient) {
  return db.db().collection<ConsumerRevision>('queue_consumer_revisions')
}

export function producerRevisions(db: MongoClient) {
  return db.db().collection<ProducerRevision>('queue_producer_revisions')
}

export function operations(db: MongoClient) {
  return db.db().collection<Operation>('idempotency_operations')
}

export async function initializeOutboxIndexes(db: MongoClient) {
  await Promise.all([
    outbox(db).createIndex({ operationId: 1, eventIndex: 1 }, { unique: true }),
    outbox(db).createIndex({ status: 1, 'lease.expiresAt': 1, createdAt: 1 }),
    outbox(db).createIndex(
      { dispatchedExpiresAt: 1 },
      { expireAfterSeconds: 0 }
    ),
    consumerReceipts(db).createIndex(
      { consumerName: 1, eventId: 1 },
      { unique: true }
    ),
    operations(db).createIndex(
      { subject: 1, route: 1, idempotencyKey: 1 },
      { unique: true }
    ),
    operations(db).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  ])
}

export type OutboxCollections = {
  outbox: Collection<OutboxEvent>
  consumerReceipts: Collection<ConsumerReceipt>
  consumerRevisions: Collection<ConsumerRevision>
  producerRevisions: Collection<ProducerRevision>
  operations: Collection<Operation>
}

export function outboxCollections(db: MongoClient): OutboxCollections {
  return {
    outbox: outbox(db),
    consumerReceipts: consumerReceipts(db),
    consumerRevisions: consumerRevisions(db),
    producerRevisions: producerRevisions(db),
    operations: operations(db)
  }
}
