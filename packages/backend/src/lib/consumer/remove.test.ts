/* eslint-disable @typescript-eslint/ban-ts-comment,  no-empty-pattern */
import { vi, test as baseTest, expect } from 'vitest'
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
import { getTestMongoClient } from '../../../test/testUtil.js'
import { collections } from '../db.js'
import { client } from '../redis.js'
import { initConsumerGroup, consumeGroup } from './common.js'
import { remove, initRemoveConsumerGroup, consumeRemove } from './remove.js'

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

test('initRemoveConsumerGroup', async () => {
  const init = vi.mocked(initConsumerGroup)

  await initRemoveConsumerGroup()

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][0]).toStrictEqual(config.stream.REMOVE_USER)
})

test('consumeRemove', async ({ testDb }) => {
  const consume = vi.mocked(consumeGroup)

  await consumeRemove(testDb)

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][2]).toStrictEqual(config.stream.REMOVE_USER)
})

test('remove', async ({ testDb }) => {
  const xack = vi.fn()
  // @ts-expect-error
  vi.mocked(client).mockImplementation(() => ({ xack }))
  xack.mockClear()
  xack.mockResolvedValue(1)

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

  const before = await collections(testDb).removed.find({ _id: userId }).toArray()
  expect(before.length).toStrictEqual(0)

  await remove(testDb, 'queue-id', ['user', userId.toHexString()])

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
