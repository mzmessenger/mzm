import {
  ObjectId,
  type Collection,
  type Filter,
  type MongoClient
} from 'mongodb'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'

export type Operation = {
  _id: ObjectId
  subject: string
  route: string
  idempotencyKey: string
  requestHash: string
  response: { status: number; body: string }
  outboxEventIds: string[]
  createdAt: Date
  expiresAt: Date
}
export type OutboxEvent = Omit<QueueWireEvent, 'operationId'> & {
  _id: string
  operationId: ObjectId
  status: 'pending' | 'leased' | 'dispatched'
  attempts: number
  lease?: { owner: string; expiresAt: Date }
  publishedAt?: Date
  dispatchedExpiresAt?: Date
}
export type ProducerRevision = { _id: string; revision: number }
export type ConsumerReceipt = {
  _id: string
  consumerName: 'backend' | 'auth'
  eventId: string
  processedAt: Date
}

export function outbox(db: MongoClient) {
  return db.db().collection<OutboxEvent>('queue_outbox')
}

export function operations(db: MongoClient) {
  return db.db().collection<Operation>('idempotency_operations')
}

export function producerRevisions(db: MongoClient) {
  return db.db().collection<ProducerRevision>('queue_producer_revisions')
}

export function consumerReceipts(db: MongoClient) {
  return db.db().collection<ConsumerReceipt>('queue_consumer_receipts')
}

export async function initializeOutboxIndexes(db: MongoClient) {
  await Promise.all([
    operations(db).createIndex(
      { subject: 1, route: 1, idempotencyKey: 1 },
      { unique: true }
    ),
    operations(db).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    outbox(db).createIndex({ operationId: 1, eventIndex: 1 }, { unique: true }),
    // claimOutbox scans by status and expired lease.
    outbox(db).createIndex({ status: 1, 'lease.expiresAt': 1, createdAt: 1 }),
    // acknowledgeOutbox stamps dispatchedExpiresAt; without the TTL index
    // dispatched rows are never reclaimed.
    outbox(db).createIndex(
      { dispatchedExpiresAt: 1 },
      { expireAfterSeconds: 0 }
    ),
    consumerReceipts(db).createIndex(
      { consumerName: 1, eventId: 1 },
      { unique: true }
    )
  ])
}

export type OutboxCollections = {
  outbox: Collection<OutboxEvent>
  operations: Collection<Operation>
  producerRevisions: Collection<ProducerRevision>
  consumerReceipts: Collection<ConsumerReceipt>
}

export function outboxCollections(db: MongoClient): OutboxCollections {
  return {
    outbox: outbox(db),
    operations: operations(db),
    producerRevisions: producerRevisions(db),
    consumerReceipts: consumerReceipts(db)
  }
}

export type OutboxFilter = Filter<OutboxEvent>
