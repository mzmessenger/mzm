import { ObjectId, type MongoClient } from 'mongodb'
import type { QueueEvent } from 'mzm-shared/src/lib/queue'
import { logger } from './logger.js'
import { collections } from './db.js'

export async function removeUser({
  db,
  event
}: {
  db: MongoClient
  event: QueueEvent<'removeUser'>
}) {
  const userId = new ObjectId(event.payload.userId)
  const target = await collections(db).users.findOne({ _id: userId })
  if (!target) {
    return
  }
  const { _id: originId, ...account } = target
  await collections(db).removed.updateOne(
    { originId },
    { $set: { ...account, originId } },
    { upsert: true }
  )
  await collections(db).users.deleteOne({ _id: originId })
  logger.info({ label: 'remove:user', user: event.payload.userId })
}
