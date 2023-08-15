import { vi, test, expect, beforeAll } from 'vitest'
vi.mock('../logger.js')
vi.mock('../redis.js', () => {
  return {
    client: vi.fn(() => ({
      xack: vi.fn()
    }))
  }
})
vi.mock('./common.js', () => {
  return {
    initConsumerGroup: vi.fn(),
    consumeGroup: vi.fn(),
    createParser: vi.fn()
  }
})
vi.mock('../db.js', async () => {
  const actual = await vi.importActual<typeof import('../db.js')>('../db.js')
  return { ...actual, mongoClient: vi.fn() }
})

import { ObjectId } from 'mongodb'
import * as config from '../../config.js'
import { createXackMock, getTestMongoClient } from '../../../test/testUtil.js'
import { UnreadQueue } from '../../types.js'
import { collections, type User } from '../db.js'
import * as redis from '../redis.js'
import { initConsumerGroup, consumeGroup } from './common.js'
import { increment, initUnreadConsumerGroup, consumeUnread } from './unread.js'

beforeAll(async () => {
  const { mongoClient } = await import('../db.js')
  const { getTestMongoClient } = await import('../../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

test('initUnreadConsumerGroup', async () => {
  const init = vi.mocked(initConsumerGroup)

  await initUnreadConsumerGroup()

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][0]).toStrictEqual(config.stream.UNREAD)
})

test('consumeUnread', async () => {
  const consume = vi.mocked(consumeGroup)

  await consumeUnread()

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][2]).toStrictEqual(config.stream.UNREAD)
})

test('increment', async () => {
  const xack = createXackMock(redis.client)
  xack.mockClear()
  xack.mockResolvedValue(1)

  const maxIndex = 1
  const maxValue = 100

  const userIds = [new ObjectId(), new ObjectId(), new ObjectId()]
  const users: User[] = userIds.map((userId) => {
    return { _id: userId, account: userId.toHexString(), roomOrder: [] }
  })

  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertMany(users)
  const roomId = new ObjectId()
  const enter = userIds.map((userId) => ({
    userId,
    roomId,
    unreadCounter: 0,
    replied: 0
  }))
  // max test
  enter[maxIndex].unreadCounter = maxValue
  await collections(db).enter.insertMany(enter)

  const _unreadQueue: UnreadQueue = {
    roomId: roomId.toHexString(),
    messageId: new ObjectId().toHexString()
  }
  const unreadQueue = JSON.stringify(_unreadQueue)
  await increment('queue-id', ['unread', unreadQueue])

  let targets = await collections(db)
    .enter.find({ userId: { $in: userIds }, roomId })
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

  targets = await collections(db)
    .enter.find({ userId: { $in: userIds }, roomId })
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
