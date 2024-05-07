/* eslint-disable @typescript-eslint/ban-ts-comment */
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
import { getTestMongoClient } from '../../../test/testUtil.js'
import { collections } from '../db.js'
import { client } from '../redis.js'
import { initConsumerGroup, consumeGroup } from './common.js'
import { remove, initRemoveConsumerGroup, consumeRemove } from './remove.js'

beforeAll(async () => {
  const { mongoClient } = await import('../db.js')
  const { getTestMongoClient } = await import('../../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

test('initRemoveConsumerGroup', async () => {
  const init = vi.mocked(initConsumerGroup)

  await initRemoveConsumerGroup()

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][0]).toStrictEqual(config.stream.REMOVE_USER)
})

test('consumeRemove', async () => {
  const consume = vi.mocked(consumeGroup)

  await consumeRemove()

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][2]).toStrictEqual(config.stream.REMOVE_USER)
})

test('remove', async () => {
  const xack = vi.fn()
  // @ts-expect-error
  vi.mocked(client).mockImplementation(() => ({ xack }))
  xack.mockClear()
  xack.mockResolvedValue(1)

  const userId = new ObjectId()
  const roomIds = [new ObjectId(), new ObjectId()]
  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertOne({
    _id: userId,
    account: 'test',
    roomOrder: []
  })
  const insert = roomIds.map((roomId) => {
    return { userId, roomId, unreadCounter: 0, replied: 0 }
  })
  await collections(db).enter.insertMany(insert)

  const before = await collections(db).removed.find({ _id: userId }).toArray()
  expect(before.length).toStrictEqual(0)

  await remove('queue-id', ['user', userId.toHexString()])

  const removed = await collections(db)
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

  const enter = await collections(db).enter.find({ userId }).toArray()
  expect(enter.length).toStrictEqual(0)

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
})
