import { type MongoClient, ObjectId } from 'mongodb'
import * as config from '../../config.js'
import { UnreadQueue } from '../../types.js'
import { collections } from '../db.js'
import { type ExRedisClient } from '../redis.js'
import { logger } from '../logger.js'
import { initConsumerGroup, createParser, consumeGroup } from './common.js'

const STREAM = config.stream.UNREAD
const UNREAD_GROUP = 'group:unread'

export async function initUnreadConsumerGroup(client: ExRedisClient) {
  await initConsumerGroup(client, STREAM, UNREAD_GROUP)
}

export async function increment({
  redis,
  db,
  ackId,
  messages
}: Parameters<Parameters<typeof createParser>[1]>[0]) {
  const queue = JSON.parse(messages[1]) as UnreadQueue

  await collections(db).enter.updateMany(
    { roomId: new ObjectId(queue.roomId), unreadCounter: { $lt: 100 } },
    { $inc: { unreadCounter: 1 } }
  )
  await redis.xack(STREAM, UNREAD_GROUP, ackId)

  logger.info('[unread:increment]', queue.roomId)
}

export async function consumeUnread({
  redis,
  db
}: {
  redis: ExRedisClient
  db: MongoClient
}) {
  const parser = createParser({ redis, db }, increment)
  await consumeGroup(redis, UNREAD_GROUP, 'consume-backend', STREAM, parser)
}
