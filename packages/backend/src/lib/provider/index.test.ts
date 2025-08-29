import { vi, expect } from 'vitest'
import { createTest } from '../../../test/testUtil.js'
vi.mock('../logger.js')
import { type ExRedisClient } from '../redis.js'
import { ObjectId } from 'mongodb'
import { ToClientType } from 'mzm-shared/src/type/socket'
import * as config from '../../config.js'
import { addQueueToUsers, addUnreadQueue, addRepliedQueue } from './index.js'

const test = await createTest(globalThis)

test('addQueueToUsers', async () => {
  const xadd = vi.fn()
  const redis = { xadd } as unknown as ExRedisClient

  const users = ['5cc9d148139370d11b706624']

  const queue: ToClientType = {
    user: '',
    cmd: 'rooms',
    rooms: [],
    roomOrder: []
  }

  await addQueueToUsers(redis, users, queue)

  expect(xadd.mock.calls.length).toBe(1)

  const [stream, , , , , queueStr] = xadd.mock.calls[0]
  expect(stream).toEqual(config.stream.MESSAGE)
  expect(queueStr).toEqual(JSON.stringify({ ...queue, user: users[0] }))
})

test('addUnreadQueue', async () => {
  const xadd = vi.fn()
  const redis = { xadd } as unknown as ExRedisClient
  xadd.mockClear()

  const roomId = new ObjectId()
  const userId = new ObjectId()

  await addUnreadQueue(redis, roomId.toHexString(), userId.toHexString())

  expect(xadd.mock.calls.length).toBe(1)

  const [stream] = xadd.mock.calls[0]
  expect(stream).toEqual(config.stream.UNREAD)
})

test('addRepliedQueue', async () => {
  const xadd = vi.fn()
  const redis = { xadd } as unknown as ExRedisClient
  xadd.mockClear()

  const roomId = new ObjectId()
  const userId = new ObjectId()

  await addRepliedQueue(redis, roomId.toHexString(), userId.toHexString())

  expect(xadd.mock.calls.length).toBe(1)

  const [stream] = xadd.mock.calls[0]
  expect(stream).toEqual(config.stream.REPLY)
})
