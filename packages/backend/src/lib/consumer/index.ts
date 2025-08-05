import { type MongoClient } from 'mongodb'
import { type ExRedisClient } from '../redis.js'
import { initRemoveConsumerGroup, consumeRemove } from './remove.js'
import { initUnreadConsumerGroup, consumeUnread } from './unread.js'
import { initReplyConsumerGroup, consumeReply } from './reply.js'
import { initVoteConsumerGroup, consumeVote } from './vote.js'
import { initMessageConsumerGroup, consumeMessage } from './message.js'

export async function initConsumer({
  db,
  redis
}: {
  db: MongoClient
  redis: ExRedisClient
}) {
  await Promise.all([
    initRemoveConsumerGroup(redis),
    initUnreadConsumerGroup(redis),
    initReplyConsumerGroup(redis),
    initVoteConsumerGroup(redis),
    initMessageConsumerGroup(redis)
  ])

  consumeRemove({ redis, db })
  consumeUnread({ redis, db })
  consumeReply({ redis, db })
  consumeVote({ redis, db })
  consumeMessage({ redis, db })
}
