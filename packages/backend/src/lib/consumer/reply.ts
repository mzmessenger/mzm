import { ObjectId } from 'mongodb'
import * as config from '../../config'
import { ReplyQueue } from '../../types'
import * as db from '../db'
import { client } from '../redis'
import { logger } from '../logger'
import { initConsumerGroup, createParser, consumeGroup } from './common'

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
