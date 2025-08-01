import { type MongoClient, ObjectId } from 'mongodb'
import * as config from '../../config.js'
import { UnreadQueue } from '../../types.js'
import { collections } from '../db.js'
import { client } from '../redis.js'
import { logger } from '../logger.js'
import { initConsumerGroup, createParser, consumeGroup } from './common.js'

const STREAM = config.stream.UNREAD
const UNREAD_GROUP = 'group:unread'

export async function initUnreadConsumerGroup() {
  await initConsumerGroup(STREAM, UNREAD_GROUP)
}

export async function increment(db: MongoClient, ackid: string, messages: string[]) {
  const queue = JSON.parse(messages[1]) as UnreadQueue

  await collections(db).enter.updateMany(
    { roomId: new ObjectId(queue.roomId), unreadCounter: { $lt: 100 } },
    { $inc: { unreadCounter: 1 } }
  )
  await client().xack(STREAM, UNREAD_GROUP, ackid)

  logger.info('[unread:increment]', queue.roomId)
}

export async function consumeUnread(db: MongoClient) {
  const parser = createParser(db, increment)
  await consumeGroup(UNREAD_GROUP, 'consume-backend', STREAM, parser)
}
