import { vi, test, expect, beforeAll } from 'vitest'
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

beforeAll(async () => {
  const { mongoClient } = await import('../lib/db.js')
  const { getTestMongoClient } = await import('../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

test('init', async () => {
  await init()

  expect(init.call.length).toStrictEqual(1)
  expect(initConsumer.call.length).toStrictEqual(1)
  expect(addInitializeSearchRoomQueue.call.length).toStrictEqual(1)

  const db = await getTestMongoClient(globalThis)
  const general = await collections(db)
    .rooms.find({ name: config.room.GENERAL_ROOM_NAME })
    .toArray()

  expect(general.length).toStrictEqual(1)
  expect(general[0].name).toStrictEqual(config.room.GENERAL_ROOM_NAME)
})

test('init twice', async () => {
  await init()
  await init()

  const db = await getTestMongoClient(globalThis)
  const general = await collections(db)
    .rooms.find({ name: config.room.GENERAL_ROOM_NAME })
    .toArray()

  expect(general.length).toStrictEqual(1)
})
