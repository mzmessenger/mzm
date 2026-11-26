import { ObjectId, type ClientSession, type MongoClient } from 'mongodb'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'
import { collections, type Removed } from '../db.js'
import { logger } from '../logger.js'

export async function remove({
  db,
  event,
  session
}: {
  db: MongoClient
  event: QueueWireEvent<'removeUser'>
  session?: ClientSession
}) {
  const { userId: user } = event.payload
  const userId = new ObjectId(user)
  const target = await collections(db).users.findOne({ _id: userId }, { session })
  if (!target) {
    await collections(db).enter.deleteMany({ userId }, { session })
    return
  }
  const enter = await collections(db).enter.find({ userId }, { session }).toArray()
  const removed: Pick<Removed, 'account' | 'originId' | 'enter'> = {
    account: target.account,
    originId: target._id,
    enter: enter.map((entry) => entry.roomId)
  }
  await collections(db).removed.updateOne(
    { originId: target._id },
    { $setOnInsert: removed },
    { upsert: true, session }
  )
  await collections(db).enter.deleteMany({ userId: target._id }, { session })
  await collections(db).users.deleteOne({ _id: target._id }, { session })
  logger.info('[remove:user]', user)
}
