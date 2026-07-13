import { ObjectId, type MongoClient } from 'mongodb'
import type { QueueEvent } from 'mzm-shared/src/lib/queue'
import { collections } from '../db.js'
import { logger } from '../logger.js'

export async function increment({
  db,
  event
}: {
  db: MongoClient
  event: QueueEvent<'unread'>
}) {
  const { roomId } = event.payload
  await collections(db).enter.updateMany(
    {
      roomId: new ObjectId(roomId),
      unreadCounter: { $lt: 100 },
      processedEventIds: { $ne: event.id }
    },
    {
      $inc: { unreadCounter: 1 },
      $push: {
        processedEventIds: { $each: [event.id], $slice: -1000 }
      }
    }
  )
  logger.info('[unread:increment]', roomId)
}
