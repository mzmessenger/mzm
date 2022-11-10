import { vi, test, expect } from 'vitest'
vi.mock('../logger')
vi.mock('../redis', () => {
  return {
    client: {
      xadd: vi.fn()
    }
  }
})
import { ObjectId } from 'mongodb'
import { ToClientType } from 'mzm-shared/type/socket'
import { createXaddMock } from '../../../test/testUtil'
import { client } from '../redis'
import * as config from '../../config'
import { addQueueToUsers, addUnreadQueue, addRepliedQueue } from './index'

const xadd = createXaddMock(client.xadd)

test('addQueueToUsers', async () => {
  xadd.mockClear()

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
  xadd.mockClear()

  const roomId = new ObjectId()
  const userId = new ObjectId()

  await addUnreadQueue(roomId.toHexString(), userId.toHexString())

  expect(xadd.mock.calls.length).toBe(1)

  const [stream] = xadd.mock.calls[0]
  expect(stream).toEqual(config.stream.UNREAD)
})

test('addRepliedQueue', async () => {
  xadd.mockClear()

  const roomId = new ObjectId()
  const userId = new ObjectId()

  await addRepliedQueue(roomId.toHexString(), userId.toHexString())

  expect(xadd.mock.calls.length).toBe(1)

  const [stream] = xadd.mock.calls[0]
  expect(stream).toEqual(config.stream.REPLY)
})
