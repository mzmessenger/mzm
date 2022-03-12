jest.mock('../logger')
jest.mock('../redis', () => {
  return {
    client: {
      xack: jest.fn()
    }
  }
})
jest.mock('./common', () => {
  return {
    initConsumerGroup: jest.fn(),
    consumeGroup: jest.fn(),
    createParser: jest.fn()
  }
})

import { ObjectId } from 'mongodb'
import * as config from '../../config'
import { createXackMock, mongoSetup } from '../../../jest/testUtil'
import { UnreadQueue } from '../../types'
import * as db from '../db'
import * as redis from '../redis'
import { initConsumerGroup, consumeGroup } from './common'
import { increment, initUnreadConsumerGroup, consumeUnread } from './unread'

let mongoServer = null

beforeAll(async () => {
  const mongo = await mongoSetup()
  mongoServer = mongo.mongoServer
  return await db.connect(mongo.uri)
})

afterAll(async () => {
  await db.close()
  await mongoServer.stop()
})

test('initUnreadConsumerGroup', async () => {
  const init = jest.mocked(initConsumerGroup)

  await initUnreadConsumerGroup()

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][0]).toStrictEqual(config.stream.UNREAD)
})

test('consumeUnread', async () => {
  const consume = jest.mocked(consumeGroup)

  await consumeUnread()

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][2]).toStrictEqual(config.stream.UNREAD)
})

test('increment', async () => {
  const xack = createXackMock(redis.client.xack)
  xack.mockClear()
  xack.mockResolvedValue(1)

  const maxIndex = 1
  const maxValue = 100

  const userIds = [new ObjectId(), new ObjectId(), new ObjectId()]
  const users: db.User[] = userIds.map((userId) => {
    return { _id: userId, account: userId.toHexString(), roomOrder: [] }
  })
  await db.collections.users.insertMany(users)
  const roomId = new ObjectId()
  const enter = userIds.map((userId) => ({
    userId,
    roomId,
    unreadCounter: 0,
    replied: 0
  }))
  // max test
  enter[maxIndex].unreadCounter = maxValue
  await db.collections.enter.insertMany(enter)

  const _unreadQueue: UnreadQueue = {
    roomId: roomId.toHexString(),
    messageId: new ObjectId().toHexString()
  }
  const unreadQueue = JSON.stringify(_unreadQueue)
  await increment('queue-id', ['unread', unreadQueue])

  let targets = await db.collections.enter
    .find({ userId: { $in: userIds }, roomId })
    .toArray()
  expect(targets.length).toStrictEqual(enter.length)
  for (const target of targets) {
    if (target.userId.toHexString() === userIds[maxIndex].toHexString()) {
      // ignore max
      expect(target.unreadCounter).toStrictEqual(maxValue)
    } else {
      // +1
      expect(target.unreadCounter).toStrictEqual(1)
    }
  }
  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')

  // call twice
  await increment('queue-id', ['unread', unreadQueue])

  targets = await db.collections.enter
    .find({ userId: { $in: userIds }, roomId })
    .toArray()
  for (const target of targets) {
    if (target.userId.toHexString() === userIds[maxIndex].toHexString()) {
      // ignore max
      expect(target.unreadCounter).toStrictEqual(maxValue)
    } else {
      // +1
      expect(target.unreadCounter).toStrictEqual(2)
    }
  }
})
