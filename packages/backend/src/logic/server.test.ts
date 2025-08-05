/* eslint-disable no-empty-pattern */
import { vi, test as baseTest, expect } from 'vitest'
vi.mock('../lib/logger.js')
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

import { collections } from '../lib/db.js'
import * as config from '../config.js'
import { init } from './server.js'
import { initConsumer } from '../lib/consumer/index.js'
import { getTestMongoClient, getTestRedisClient } from '../../test/testUtil.js'

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
  testRedis: Awaited<ReturnType<typeof getTestRedisClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  },
  testRedis: async ({}, use) => {
    const redis = await getTestRedisClient(globalThis)
    await use(redis)
  }
})

test('init', async ({ testDb, testRedis }) => {
  await init({ db: testDb, redis: testRedis })

  expect(init.call.length).toStrictEqual(1)
  expect(initConsumer.call.length).toStrictEqual(1)

  const general = await collections(testDb)
    .rooms.find({ name: config.room.GENERAL_ROOM_NAME })
    .toArray()

  expect(general.length).toStrictEqual(1)
  expect(general[0].name).toStrictEqual(config.room.GENERAL_ROOM_NAME)
})

test('init twice', async ({ testDb, testRedis }) => {
  await init({ db: testDb, redis: testRedis })
  await init({ db: testDb, redis: testRedis })

  const db = await getTestMongoClient(globalThis)
  const general = await collections(db)
    .rooms.find({ name: config.room.GENERAL_ROOM_NAME })
    .toArray()

  expect(general.length).toStrictEqual(1)
})
