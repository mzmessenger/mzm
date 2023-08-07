import { vi, test, expect } from 'vitest'
vi.mock('../logger')
vi.mock('../redis', () => {
  return {
    client: vi.fn(() => ({
      xadd: vi.fn()
    }))
  }
})
import { ObjectId } from 'mongodb'
import { ToClientType } from 'mzm-shared/type/socket'
import { createXaddMock } from '../../../test/testUtil'
import { client } from '../redis'
import * as config from '../../config'
import { addQueueToUsers, addUnreadQueue, addRepliedQueue } from './index'

test('addQueueToUsers', async () => {
  const xadd = createXaddMock(client)

  const users = ['5cc9d148139370d11b706624']

  const queue: ToClientType = {
    user: '',
    cmd: 'rooms',
    rooms: [],
    roomOrder: []
  }

  await addQueueToUsers(users, queue)

  expect(xadd.mock.calls.length).toBe(1)

  const [stream, , , , , queueStr] = xadd.mock.calls[0]
  expect(stream).toEqual(config.stream.MESSAGE)
  expect(queueStr).toEqual(JSON.stringify({ ...queue, user: users[0] }))
})

test('addUnreadQueue', async () => {
  const xadd = createXaddMock(client)
  xadd.mockClear()

  const roomId = new ObjectId()
  const userId = new ObjectId()

  await addUnreadQueue(roomId.toHexString(), userId.toHexString())

  expect(xadd.mock.calls.length).toBe(1)

  const [stream] = xadd.mock.calls[0]
  expect(stream).toEqual(config.stream.UNREAD)
})

test('addRepliedQueue', async () => {
  const xadd = createXaddMock(client)
  xadd.mockClear()

  const roomId = new ObjectId()
  const userId = new ObjectId()

  await addRepliedQueue(roomId.toHexString(), userId.toHexString())

  expect(xadd.mock.calls.length).toBe(1)

  const [stream] = xadd.mock.calls[0]
  expect(stream).toEqual(config.stream.REPLY)
})
