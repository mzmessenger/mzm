import {
  initRemoveConsumerGroup,
  consumeRemove
} from '../lib/consumer/remove.js'
import {
  initUnreadConsumerGroup,
  consumeUnread
} from '../lib/consumer/unread.js'
import { initReplyConsumerGroup, consumeReply } from '../lib/consumer/reply.js'
import {
  initSearchRoomConsumerGroup,
  consumeSearchRooms
} from '../lib/consumer/search/room.js'
import { initJobConsumerGroup, consumeJob } from '../lib/consumer/job.js'
import { initRenameConsumerGroup, consumeVote } from '../lib/consumer/vote.js'
import { addInitializeSearchRoomQueue } from '../lib/provider/index.js'
import { initGeneral } from './rooms.js'

export const init = async () => {
  await Promise.all([
    initGeneral(),
    initRemoveConsumerGroup(),
    initUnreadConsumerGroup(),
    initReplyConsumerGroup(),
    initSearchRoomConsumerGroup(),
    initJobConsumerGroup(),
    initRenameConsumerGroup()
  ])

  consumeRemove()
  consumeUnread()
  consumeReply()
  consumeSearchRooms()
  consumeJob()
  consumeVote()

  addInitializeSearchRoomQueue()
}
