import { type MongoClient } from 'mongodb'
import { initRemoveConsumerGroup, consumeRemove } from './remove.js'
import { initUnreadConsumerGroup, consumeUnread } from './unread.js'
import { initReplyConsumerGroup, consumeReply } from './reply.js'
import {
  initSearchRoomConsumerGroup,
  consumeSearchRooms
} from './search/room.js'
import { initJobConsumerGroup, consumeJob } from './job.js'
import { initVoteConsumerGroup, consumeVote } from './vote.js'
import { initMessageConsumerGroup, consumeMessage } from './message.js'

export async function initConsumer(db: MongoClient) {
  await Promise.all([
    initRemoveConsumerGroup(),
    initUnreadConsumerGroup(),
    initReplyConsumerGroup(),
    initSearchRoomConsumerGroup(),
    initJobConsumerGroup(),
    initVoteConsumerGroup(),
    initMessageConsumerGroup()
  ])

  consumeRemove(db)
  consumeUnread(db)
  consumeReply(db)
  consumeSearchRooms(db)
  consumeJob(db)
  consumeVote(db)
  consumeMessage(db)
}
