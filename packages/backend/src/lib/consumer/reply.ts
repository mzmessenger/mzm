import { ObjectId } from 'mongodb'
import * as config from '../../config.js'
import { ReplyQueue } from '../../types.js'
import * as db from '../db.js'
import { client } from '../redis.js'
import { logger } from '../logger.js'
import { initConsumerGroup, createParser, consumeGroup } from './common.js'

const STREAM = config.stream.REPLY
const REPLY_GROUP = 'group:reply'

export const initReplyConsumerGroup = async () => {
  await initConsumerGroup(STREAM, REPLY_GROUP)
}

export const reply = async (ackid: string, messages: string[]) => {
  const queue = JSON.parse(messages[1]) as ReplyQueue

  await db.collections.enter.updateOne(
    {
      userId: new ObjectId(queue.userId),
      roomId: new ObjectId(queue.roomId),
      replied: { $lt: 100 }
    },
    { $inc: { replied: 1 } }
  )
  await client.xack(STREAM, REPLY_GROUP, ackid)

  logger.info('[reply]', 'roomId:', queue.roomId, 'userId:', queue.userId)
}

export const consumeReply = async () => {
  const parser = createParser(reply)
  await consumeGroup(REPLY_GROUP, 'consume-backend', STREAM, parser)
}
