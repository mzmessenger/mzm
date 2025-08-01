/* eslint-disable no-empty-pattern */
import { vi, test as baseTest, expect } from 'vitest'
vi.mock('../lib/logger.js')
vi.mock('../lib/redis.js', () => {
  return {
    client: {
      xadd: vi.fn()
    },
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})
vi.mock('../lib/consumer/index.js', () => {
  return {
    initConsumer: vi.fn()
  }
})
vi.mock('../lib/provider/index.js', () => {
  return {
    addInitializeSearchRoomQueue: vi.fn()
  }
})
vi.mock('../lib/db.js', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/db.js')>('../lib/db.js')
  return { ...actual, mongoClient: vi.fn() }
})

import { collections } from '../lib/db.js'
import * as config from '../config.js'
import { init } from './server.js'
import { initConsumer } from '../lib/consumer/index.js'
import { addInitializeSearchRoomQueue } from '../lib/provider/index.js'
import { getTestMongoClient } from '../../test/testUtil.js'

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

test('init', async ({ testDb }) => {
  await init(testDb)

  expect(init.call.length).toStrictEqual(1)
  expect(initConsumer.call.length).toStrictEqual(1)
  expect(addInitializeSearchRoomQueue.call.length).toStrictEqual(1)

  const general = await collections(testDb)
    .rooms.find({ name: config.room.GENERAL_ROOM_NAME })
    .toArray()

  expect(general.length).toStrictEqual(1)
  expect(general[0].name).toStrictEqual(config.room.GENERAL_ROOM_NAME)
})

test('init twice', async ({ testDb }) => {
  await init(testDb)
  await init(testDb)

  const db = await getTestMongoClient(globalThis)
  const general = await collections(db)
    .rooms.find({ name: config.room.GENERAL_ROOM_NAME })
    .toArray()

  expect(general.length).toStrictEqual(1)
})
