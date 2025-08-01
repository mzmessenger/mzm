import { type MongoClient, ObjectId } from 'mongodb'
import * as config from '../../config.js'
import { collections, type Removed } from '../db.js'
import { client } from '../redis.js'
import { logger } from '../logger.js'
import { initConsumerGroup, createParser, consumeGroup } from './common.js'

const REMOVE_STREAM = config.stream.REMOVE_USER
const REMOVE_GROUP = 'group:backend:remove:user'

export async function initRemoveConsumerGroup() {
  await initConsumerGroup(REMOVE_STREAM, REMOVE_GROUP)
}

export async function remove(db: MongoClient, ackid: string, messages: string[]) {
  const user = messages[1]
  const userId = new ObjectId(user)
  const target = await collections(db).users.findOne({ _id: userId })
  if (!target) {
    return
  }
  // @todo atomic
  const enter = await collections(db).enter.find({ userId: userId }).toArray()
  const ids = enter.map((e) => e.roomId)
  const remove: Pick<Removed, 'account' | 'originId' | 'enter'> = {
    account: target.account,
    originId: target._id,
    enter: ids
  }
  await collections(db).removed.updateMany(
    { originId: target._id },
    { $set: remove },
    { upsert: true }
  )
  await collections(db).users.deleteOne({ _id: target._id })
  await collections(db).enter.deleteMany({ userId: target._id })

  await client().xack(REMOVE_STREAM, REMOVE_GROUP, ackid)
  logger.info('[remove:user]', user)
}

export async function consumeRemove(db: MongoClient) {
  const parser = createParser(db, remove)
  await consumeGroup(REMOVE_GROUP, 'consume-backend', REMOVE_STREAM, parser)
}
