import { ObjectId, type MongoClient } from 'mongodb'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'
import { logger } from './logger.js'
import { collections } from './db.js'
import { consumerReceipts, outbox } from './db/outbox.js'

type RemoveUserEvent = QueueWireEvent & {
  type: 'removeUser'
  payload: { userId: string }
}

function isRemoveUserEvent(event: QueueWireEvent): event is RemoveUserEvent {
  return (
    event.type === 'removeUser' &&
    typeof event.payload === 'object' &&
    event.payload !== null &&
    typeof Reflect.get(event.payload, 'userId') === 'string'
  )
}

export async function removeUser({
  db,
  event
}: {
  db: MongoClient
  event: QueueWireEvent
}) {
  if (!isRemoveUserEvent(event)) throw new Error('invalid auth queue event')
  const userId = new ObjectId(event.payload.userId)
  let processed = false
  await db.withSession(async (session) => {
    await session.withTransaction(async () => {
      const receipt = await consumerReceipts(db).updateOne(
        { _id: `auth:${event.eventId}` },
        {
          $setOnInsert: {
            consumerName: 'auth',
            eventId: event.eventId,
            processedAt: new Date(),
            createdAt: new Date()
          }
        },
        { upsert: true, session }
      )
      if (receipt.upsertedCount === 0) return
      const target = await collections(db).users.findOne(
        { _id: userId },
        { session }
      )
      if (target) {
        const { _id: originId, ...account } = target
        await collections(db).removed.updateOne(
          { originId },
          { $set: { ...account, originId } },
          { upsert: true, session }
        )
        await collections(db).users.deleteOne({ _id: originId }, { session })
      }
      // The backend keeps its own copy of the account (user doc, enter
      // records). Queue routing is destination-based, so a follow-up event
      // with destination 'backend' is what actually reaches it. Emitting it
      // inside this transaction keeps it exactly-once with the auth-side
      // receipt.
      const operationId = new ObjectId()
      await outbox(db).insertOne(
        {
          _id: `${operationId.toHexString()}:0`,
          version: 1,
          eventId: `${operationId.toHexString()}:0`,
          operationId,
          eventIndex: 0,
          destination: 'backend',
          type: 'removeUser',
          payload: { userId: event.payload.userId },
          ordering: { key: `user:${event.payload.userId}`, revision: 1 },
          createdAt: new Date().toISOString(),
          status: 'pending',
          attempts: 0
        },
        { session }
      )
      processed = true
    })
  })
  if (processed)
    logger.info({ label: 'remove:user', user: event.payload.userId })
}
