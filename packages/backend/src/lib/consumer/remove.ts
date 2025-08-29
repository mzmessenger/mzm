import { type MongoClient, ObjectId } from 'mongodb'
import * as config from '../../config.js'
import { collections, type Removed } from '../db.js'
import { type ExRedisClient } from '../redis.js'
import { logger } from '../logger.js'
import { initConsumerGroup, createParser, consumeGroup } from './common.js'

const REMOVE_STREAM = config.stream.REMOVE_USER
const REMOVE_GROUP = 'group:backend:remove:user'

export async function initRemoveConsumerGroup(client: ExRedisClient) {
  await initConsumerGroup(client, REMOVE_STREAM, REMOVE_GROUP)
}

export async function remove({
  redis,
  db,
  ackId,
  messages
}: Parameters<Parameters<typeof createParser>[1]>[0]) {
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

  await redis.xack(REMOVE_STREAM, REMOVE_GROUP, ackId)
  logger.info('[remove:user]', user)
}

export async function consumeRemove({
  redis,
  db
}: {
  redis: ExRedisClient
  db: MongoClient
}) {
  const parser = createParser({ redis, db }, remove)
  await consumeGroup(
    redis,
    REMOVE_GROUP,
    'consume-backend',
    REMOVE_STREAM,
    parser
  )
}
