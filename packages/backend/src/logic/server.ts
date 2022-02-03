import { initRemoveConsumerGroup, consumeRemove } from '../lib/consumer/remove'
import { initUnreadConsumerGroup, consumeUnread } from '../lib/consumer/unread'
import { initReplyConsumerGroup, consumeReply } from '../lib/consumer/reply'
import {
  initSearchRoomConsumerGroup,
  consumeSearchRooms
} from '../lib/consumer/search/room'
import { initJobConsumerGroup, consumeJob } from '../lib/consumer/job'
import { initRenameConsumerGroup, consumeVote } from '../lib/consumer/vote'
import { addInitializeSearchRoomQueue } from '../lib/provider/index'
import { initGeneral } from './rooms'

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
