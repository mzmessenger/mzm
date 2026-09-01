import { ObjectId, type ClientSession, type MongoClient } from 'mongodb'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'
import { collections } from '../db.js'
import { logger } from '../logger.js'

export async function increment({
  db,
  event,
  session
}: {
  db: MongoClient
  event: QueueWireEvent<'unread'>
  session?: ClientSession
}) {
  const { roomId } = event.payload
  await collections(db).enter.updateMany(
    {
      roomId: new ObjectId(roomId),
      unreadCounter: { $lt: 100 }
    },
    {
      $inc: { unreadCounter: 1 }
    },
    { session }
  )
  logger.info('[unread:increment]', roomId)
}
