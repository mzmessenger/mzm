import { type MongoClient, ObjectId } from 'mongodb'
import * as config from '../../config.js'
import { ReplyQueue } from '../../types.js'
import { collections } from '../db.js'
import { client } from '../redis.js'
import { logger } from '../logger.js'
import { initConsumerGroup, createParser, consumeGroup } from './common.js'

const STREAM = config.stream.REPLY
const REPLY_GROUP = 'group:reply'

export async function initReplyConsumerGroup() {
  await initConsumerGroup(STREAM, REPLY_GROUP)
}

export async function reply(db: MongoClient, ackid: string, messages: string[]) {
  const queue = JSON.parse(messages[1]) as ReplyQueue

  await collections(db).enter.updateOne(
    {
      userId: new ObjectId(queue.userId),
      roomId: new ObjectId(queue.roomId),
      replied: { $lt: 100 }
    },
    { $inc: { replied: 1 } }
  )
  await client().xack(STREAM, REPLY_GROUP, ackid)

  logger.info('[reply]', 'roomId:', queue.roomId, 'userId:', queue.userId)
}

export async function consumeReply(db: MongoClient) {
  const parser = createParser(db, reply)
  await consumeGroup(REPLY_GROUP, 'consume-backend', STREAM, parser)
}
