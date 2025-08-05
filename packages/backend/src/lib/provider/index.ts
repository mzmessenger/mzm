import { type ExRedisClient } from '../redis.js'
import { logger } from '../logger.js'
import { type ToClientType } from 'mzm-shared/src/type/socket'
import { UnreadQueue, ReplyQueue, VoteQueue } from '../../types.js'
import * as config from '../../config.js'

export async function addMessageQueue(
  client: ExRedisClient,
  data: ToClientType
) {
  const message = JSON.stringify(data)
  await client.xadd(
    config.stream.MESSAGE,
    'MAXLEN',
    100000,
    '*',
    'message',
    message
  )
  logger.info({
    label: 'queue:add:user',
    message
  })
}

export async function addQueueToUsers(
  client: ExRedisClient,
  users: string[],
  data: ToClientType
) {
  // todo: too heavy
  const promises = users.map((user) => {
    addMessageQueue(client, { ...data, user })
  })
  await Promise.all(promises)
}

export async function addUnreadQueue(
  client: ExRedisClient,
  roomId: string,
  messageId: string
) {
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

export async function addRepliedQueue(
  client: ExRedisClient,
  roomId: string,
  userId: string
) {
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

export async function addVoteQueue(client: ExRedisClient, messageId: string) {
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
