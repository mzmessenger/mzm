import { initRemoveConsumerGroup, consumeRemove } from './remove.js'
import { initUnreadConsumerGroup, consumeUnread } from './unread.js'
import { initReplyConsumerGroup, consumeReply } from './reply.js'
import {
  initSearchRoomConsumerGroup,
  consumeSearchRooms
} from './search/room.js'
import { initJobConsumerGroup, consumeJob } from './job.js'
import { initRenameConsumerGroup, consumeVote } from './vote.js'
import { initMessageConsumerGroup, consumeMessage } from './message.js'

export async function initConsumer() {
  await Promise.all([
    initRemoveConsumerGroup(),
    initUnreadConsumerGroup(),
    initReplyConsumerGroup(),
    initSearchRoomConsumerGroup(),
    initJobConsumerGroup(),
    initRenameConsumerGroup(),
    initMessageConsumerGroup()
  ])

  consumeRemove()
  consumeUnread()
  consumeReply()
  consumeSearchRooms()
  consumeJob()
  consumeVote()
  consumeMessage()
}
