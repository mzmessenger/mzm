import { ObjectId, type MongoClient } from 'mongodb'
import type { QueueEvent } from 'mzm-shared/src/lib/queue'
import { collections, type Removed } from '../db.js'
import { logger } from '../logger.js'

export async function remove({
  db,
  event
}: {
  db: MongoClient
  event: QueueEvent<'removeUser'>
}) {
  const { userId: user } = event.payload
  const userId = new ObjectId(user)
  const target = await collections(db).users.findOne({ _id: userId })
  if (!target) {
    await collections(db).enter.deleteMany({ userId })
    return
  }
  const enter = await collections(db).enter.find({ userId }).toArray()
  const removed: Pick<Removed, 'account' | 'originId' | 'enter'> = {
    account: target.account,
    originId: target._id,
    enter: enter.map((entry) => entry.roomId)
  }
  await collections(db).removed.updateOne(
    { originId: target._id },
    { $setOnInsert: removed },
    { upsert: true }
  )
  await collections(db).enter.deleteMany({ userId: target._id })
  await collections(db).users.deleteOne({ _id: target._id })
  logger.info('[remove:user]', user)
}
