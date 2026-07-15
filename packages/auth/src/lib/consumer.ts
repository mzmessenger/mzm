import { ObjectId, type MongoClient } from 'mongodb'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'
import { logger } from './logger.js'
import { collections } from './db.js'

type RemoveUserEvent = QueueWireEvent & { type: 'removeUser'; payload: { userId: string } }

function isRemoveUserEvent(event: QueueWireEvent): event is RemoveUserEvent {
  return event.type === 'removeUser' && typeof event.payload === 'object' && event.payload !== null && typeof Reflect.get(event.payload, 'userId') === 'string'
}

export async function removeUser({ db, event }: { db: MongoClient; event: QueueWireEvent }) {
  if (!isRemoveUserEvent(event)) throw new Error('invalid auth queue event')
  const userId = new ObjectId(event.payload.userId)
  let processed = false
  await db.withSession(async (session) => {
    await session.withTransaction(async () => {
      const receipt = await db.db().collection<{ _id: string; consumerName: string; eventId: string; processedAt: Date }>('queue_consumer_receipts').updateOne(
        { _id: `auth:${event.eventId}` },
        { $setOnInsert: { consumerName: 'auth', eventId: event.eventId, processedAt: new Date() } },
        { upsert: true, session }
      )
      if (receipt.upsertedCount === 0) return
      const target = await collections(db).users.findOne({ _id: userId }, { session })
      if (target) {
        const { _id: originId, ...account } = target
        await collections(db).removed.updateOne({ originId }, { $set: { ...account, originId } }, { upsert: true, session })
        await collections(db).users.deleteOne({ _id: originId }, { session })
      }
      processed = true
    })
  })
  if (processed) logger.info({ label: 'remove:user', user: event.payload.userId })
}
