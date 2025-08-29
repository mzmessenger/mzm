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
import { collections } from '../db.js'
import { type ExRedisClient } from '../redis.js'
import { initConsumerGroup, consumeGroup } from './common.js'
import { remove, initRemoveConsumerGroup, consumeRemove } from './remove.js'

const test = await createTest(globalThis)

test('initRemoveConsumerGroup', async ({ testRedis }) => {
  const init = vi.mocked(initConsumerGroup)

  await initRemoveConsumerGroup(testRedis)

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][1]).toStrictEqual(config.stream.REMOVE_USER)
})

test('consumeRemove', async ({ testDb, testRedis }) => {
  const consume = vi.mocked(consumeGroup)

  await consumeRemove({ db: testDb, redis: testRedis })

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][3]).toStrictEqual(config.stream.REMOVE_USER)
})

test('remove', async ({ testDb }) => {
  const xack = vi.fn()
  xack.mockClear()
  xack.mockResolvedValue(1)
  const redis = { xack } as unknown as ExRedisClient

  const userId = new ObjectId()
  const roomIds = [new ObjectId(), new ObjectId()]
  await collections(testDb).users.insertOne({
    _id: userId,
    account: 'test',
    roomOrder: []
  })
  const insert = roomIds.map((roomId) => {
    return { userId, roomId, unreadCounter: 0, replied: 0 }
  })
  await collections(testDb).enter.insertMany(insert)

  const before = await collections(testDb)
    .removed.find({ _id: userId })
    .toArray()
  expect(before.length).toStrictEqual(0)

  await remove({
    db: testDb,
    redis,
    ackId: 'queue-id',
    messages: ['user', userId.toHexString()]
  })

  const removed = await collections(testDb)
    .removed.find({ originId: userId })
    .toArray()
  expect(removed.length).toStrictEqual(1)
  const roomIdString = roomIds.map((r) => r.toHexString())
  for (const r of removed) {
    expect(r.enter.length).toStrictEqual(roomIds.length)
    for (const e of r.enter) {
      expect(roomIdString.includes(e.toHexString())).toStrictEqual(true)
    }
  }

  const enter = await collections(testDb).enter.find({ userId }).toArray()
  expect(enter.length).toStrictEqual(0)

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
})
