import { expect, test, vi } from 'vitest'
import { ObjectId } from 'mongodb'
import type { EventPublisher } from 'mzm-shared/src/lib/queue'
import type { ToClientType } from 'mzm-shared/src/type/socket'
import { addQueueToUsers, addUnreadQueue, addRepliedQueue } from './index.js'

function createPublisher() {
  const publish = vi.fn<EventPublisher['publish']>()
  return { publisher: { publish }, publish }
}

test('addQueueToUsers', async () => {
  const { publisher, publish } = createPublisher()
  const users = ['5cc9d148139370d11b706624']
  const queue: ToClientType = {
    user: '',
    cmd: 'rooms',
    rooms: [],
    roomOrder: []
  }
  await addQueueToUsers(publisher, users, queue)
  expect(publish).toHaveBeenCalledWith('message', { ...queue, user: users[0] })
})

test('addUnreadQueue', async () => {
  const { publisher, publish } = createPublisher()
  const roomId = new ObjectId().toHexString()
  const messageId = new ObjectId().toHexString()
  await addUnreadQueue(publisher, roomId, messageId)
  expect(publish).toHaveBeenCalledWith('unread', { roomId, messageId })
})

test('addRepliedQueue', async () => {
  const { publisher, publish } = createPublisher()
  const roomId = new ObjectId().toHexString()
  const userId = new ObjectId().toHexString()
  await addRepliedQueue(publisher, roomId, userId)
  expect(publish).toHaveBeenCalledWith('reply', { roomId, userId })
})
