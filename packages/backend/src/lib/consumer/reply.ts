import { ObjectId, type MongoClient } from 'mongodb'
import type { QueueEvent } from 'mzm-shared/src/lib/queue'
import { collections } from '../db.js'
import { logger } from '../logger.js'

export async function reply({
  db,
  event
}: {
  db: MongoClient
  event: QueueEvent<'reply'>
}) {
  const { roomId, userId } = event.payload
  await collections(db).enter.updateOne(
    {
      userId: new ObjectId(userId),
      roomId: new ObjectId(roomId),
      replied: { $lt: 100 },
      processedEventIds: { $ne: event.id }
    },
    {
      $inc: { replied: 1 },
      $push: {
        processedEventIds: { $each: [event.id], $slice: -1000 }
      }
    }
  )
  logger.info('[reply]', 'roomId:', roomId, 'userId:', userId)
}
