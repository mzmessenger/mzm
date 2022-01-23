import { client } from '../redis'
import { logger } from '../logger'
import { SendMessage, UnreadQueue, ReplyQueue, VoteQueue } from '../../types'
import * as config from '../../config'
export {
  addInitializeSearchRoomQueue,
  addUpdateSearchRoomQueue,
  addSyncSearchRoomQueue
} from './room'

export const addMessageQueue = async (data: SendMessage) => {
  const message = JSON.stringify(data)
  await client.xadd(
    config.stream.MESSAGE,
    'MAXLEN',
    100000,
    '*',
    'message',
    message
  )
  logger.info('[queue:add:user]', message)
}

export const addQueueToUsers = async (users: string[], data: SendMessage) => {
  // todo: too heavy
  const promises = users.map((user) => {
    addMessageQueue({ ...data, user })
  })
  await Promise.all(promises)
}

export const addUnreadQueue = async (roomId: string, messageId: string) => {
  const data: UnreadQueue = { roomId, messageId }
  client.xadd(
    config.stream.UNREAD,
    'MAXLEN',
    1000,
    '*',
    'unread',
    JSON.stringify(data)
  )
}

export const addRepliedQueue = async (roomId: string, userId: string) => {
  const data: ReplyQueue = { roomId, userId }
  client.xadd(
    config.stream.REPLY,
    'MAXLEN',
    1000,
    '*',
    'reply',
    JSON.stringify(data)
  )
}

export const addVoteQueue = async (messageId: string) => {
  const data: VoteQueue = { messageId }
  client.xadd(
    config.stream.VOTE,
    'MAXLEN',
    1000,
    '*',
    'reply',
    JSON.stringify(data)
  )
}
