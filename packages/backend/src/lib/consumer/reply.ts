import { ObjectId, type ClientSession, type MongoClient } from 'mongodb'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'
import { collections } from '../db.js'
import { logger } from '../logger.js'

export async function reply({
  db,
  event,
  session
}: {
  db: MongoClient
  event: QueueWireEvent<'reply'>
  session?: ClientSession
}) {
  const { roomId, userId } = event.payload
  await collections(db).enter.updateOne(
    {
      userId: new ObjectId(userId),
      roomId: new ObjectId(roomId),
      replied: { $lt: 100 }
    },
    {
      $inc: { replied: 1 }
    },
    { session }
  )
  logger.info('[reply]', 'roomId:', roomId, 'userId:', userId)
}
