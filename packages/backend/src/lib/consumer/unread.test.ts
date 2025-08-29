import { vi, expect } from 'vitest'
import { createTest } from '../../../test/testUtil.js'
vi.mock('../logger.js')
vi.mock('./common.js', () => {
  return {
    initConsumerGroup: vi.fn(),
    consumeGroup: vi.fn(),
    createParser: vi.fn()
  }
})

import { ObjectId } from 'mongodb'
import * as config from '../../config.js'
import { UnreadQueue } from '../../types.js'
import { collections, type User } from '../db.js'
import { type ExRedisClient } from '../redis.js'
import { initConsumerGroup, consumeGroup } from './common.js'
import { increment, initUnreadConsumerGroup, consumeUnread } from './unread.js'

const test = await createTest(globalThis)

test('initUnreadConsumerGroup', async ({ testRedis }) => {
  const init = vi.mocked(initConsumerGroup)

  await initUnreadConsumerGroup(testRedis)

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][1]).toStrictEqual(config.stream.UNREAD)
})

test('consumeUnread', async ({ testDb, testRedis }) => {
  const consume = vi.mocked(consumeGroup)

  await consumeUnread({ db: testDb, redis: testRedis })

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][3]).toStrictEqual(config.stream.UNREAD)
})

test('increment', async ({ testDb }) => {
  const xack = vi.fn()
  xack.mockClear()
  xack.mockResolvedValue(1)
  const redis = { xack } as unknown as ExRedisClient

  const maxIndex = 1
  const maxValue = 100

  const userIds = [new ObjectId(), new ObjectId(), new ObjectId()]
  const users: User[] = userIds.map((userId) => {
    return { _id: userId, account: userId.toHexString(), roomOrder: [] }
  })

  await collections(testDb).users.insertMany(users)
  const roomId = new ObjectId()
  const enter = userIds.map((userId) => ({
    userId,
    roomId,
    unreadCounter: 0,
    replied: 0
  }))
  // max test
  enter[maxIndex].unreadCounter = maxValue
  await collections(testDb).enter.insertMany(enter)

  const _unreadQueue: UnreadQueue = {
    roomId: roomId.toHexString(),
    messageId: new ObjectId().toHexString()
  }
  const unreadQueue = JSON.stringify(_unreadQueue)
  await increment({
    db: testDb,
    redis,
    ackId: 'queue-id',
    messages: ['unread', unreadQueue]
  })

  let targets = await collections(testDb)
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
  await increment({
    db: testDb,
    redis,
    ackId: 'queue-id',
    messages: ['unread', unreadQueue]
  })

  targets = await collections(testDb)
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
