import { logger } from '../logger.js'
import type { ToClientType } from 'mzm-shared/src/type/socket'
import type { EventPublisher } from '../queue.js'

export async function addMessageQueue(
  publisher: EventPublisher,
  data: ToClientType
) {
  await publisher.publish('message', data)
  logger.info({ label: 'queue:add:user', message: data })
}

export async function addQueueToUsers(
  publisher: EventPublisher,
  users: string[],
  data: ToClientType
) {
  await Promise.all(
    users.map((user) => addMessageQueue(publisher, { ...data, user }))
  )
}

export async function addUnreadQueue(
  publisher: EventPublisher,
  roomId: string,
  messageId: string
) {
  await publisher.publish('unread', { roomId, messageId })
}

export async function addRepliedQueue(
  publisher: EventPublisher,
  roomId: string,
  userId: string
) {
  await publisher.publish('reply', { roomId, userId })
}

export async function addVoteQueue(
  publisher: EventPublisher,
  messageId: string
) {
  await publisher.publish('vote', { messageId })
}
