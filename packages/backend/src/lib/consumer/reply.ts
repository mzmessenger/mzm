import { type MongoClient, ObjectId } from 'mongodb'
import * as config from '../../config.js'
import { ReplyQueue } from '../../types.js'
import { collections } from '../db.js'
import { type ExRedisClient } from '../redis.js'
import { logger } from '../logger.js'
import { initConsumerGroup, createParser, consumeGroup } from './common.js'

const STREAM = config.stream.REPLY
const REPLY_GROUP = 'group:reply'

export async function initReplyConsumerGroup(client: ExRedisClient) {
  await initConsumerGroup(client, STREAM, REPLY_GROUP)
}

export async function reply({
  redis,
  db,
  ackId,
  messages
}: Parameters<Parameters<typeof createParser>[1]>[0]) {
  const queue = JSON.parse(messages[1]) as ReplyQueue

  await collections(db).enter.updateOne(
    {
      userId: new ObjectId(queue.userId),
      roomId: new ObjectId(queue.roomId),
      replied: { $lt: 100 }
    },
    { $inc: { replied: 1 } }
  )
  await redis.xack(STREAM, REPLY_GROUP, ackId)

  logger.info('[reply]', 'roomId:', queue.roomId, 'userId:', queue.userId)
}

export async function consumeReply({
  redis,
  db
}: {
  redis: ExRedisClient
  db: MongoClient
}) {
  const parser = createParser({ redis, db }, reply)
  await consumeGroup(redis, REPLY_GROUP, 'consume-backend', STREAM, parser)
}
