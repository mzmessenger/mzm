import type { MongoMemoryServer } from 'mongodb-memory-server'
import { vi, test, expect, beforeAll, afterAll } from 'vitest'
vi.mock('../lib/logger')
vi.mock('../lib/consumer/remove', () => {
  return {
    initRemoveConsumerGroup: vi.fn(),
    consumeRemove: vi.fn()
  }
})
vi.mock('../lib/consumer/unread', () => {
  return {
    initUnreadConsumerGroup: vi.fn(),
    consumeUnread: vi.fn()
  }
})
vi.mock('../lib/consumer/reply', () => {
  return {
    initReplyConsumerGroup: vi.fn(),
    consumeReply: vi.fn()
  }
})
vi.mock('../lib/consumer/search/room', () => {
  return {
    initSearchRoomConsumerGroup: vi.fn(),
    consumeSearchRooms: vi.fn()
  }
})
vi.mock('../lib/consumer/job', () => {
  return {
    initJobConsumerGroup: vi.fn(),
    consumeJob: vi.fn()
  }
})
vi.mock('../lib/consumer/vote', () => {
  return {
    initRenameConsumerGroup: vi.fn(),
    consumeVote: vi.fn()
  }
})
vi.mock('../lib/redis', () => {
  return {
    client: {
      xadd: vi.fn()
    },
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})
vi.mock('../lib/provider/index', () => {
  return {
    addInitializeSearchRoomQueue: vi.fn()
  }
})

import { mongoSetup } from '../../test/testUtil'
import { init } from './server'
import * as db from '../lib/db'
import * as config from '../config'
import * as consumerRemove from '../lib/consumer/remove'
import * as consumerUnread from '../lib/consumer/unread'
import * as consumeReply from '../lib/consumer/reply'
import * as consumeSearchRoom from '../lib/consumer/search/room'
import * as consumeJob from '../lib/consumer/job'
import * as consumeVote from '../lib/consumer/vote'
import { addInitializeSearchRoomQueue } from '../lib/provider/index'

let mongoServer: MongoMemoryServer | null = null

beforeAll(async () => {
  const mongo = await mongoSetup()
  mongoServer = mongo.mongoServer
  await db.connect(mongo.uri)
})

afterAll(async () => {
  await db.close()
  await mongoServer?.stop()
})

test('init', async () => {
  const mocks = [
    [consumerRemove.initRemoveConsumerGroup, consumerRemove.consumeRemove],
    [consumerUnread.initUnreadConsumerGroup, consumerUnread.consumeUnread],
    [consumeReply.initReplyConsumerGroup, consumeReply.consumeReply],
    [
      consumeSearchRoom.initSearchRoomConsumerGroup,
      consumeSearchRoom.consumeSearchRooms
    ],
    [consumeJob.initJobConsumerGroup, consumeJob.consumeJob],
    [consumeVote.initRenameConsumerGroup, consumeVote.consumeVote]
  ]

  expect.assertions(mocks.length * 2 + 3)

  for (const [init, consume] of mocks) {
    const initMock = vi.mocked(init)
    initMock.mockClear()
    initMock.mockResolvedValue()
    const consumeMock = vi.mocked(consume)
    consumeMock.mockClear()
    consumeMock.mockResolvedValue()
  }

  await init()

  const general = await db.collections.rooms
    .find({ name: config.room.GENERAL_ROOM_NAME })
    .toArray()

  expect(general.length).toStrictEqual(1)
  expect(general[0].name).toStrictEqual(config.room.GENERAL_ROOM_NAME)
  expect(addInitializeSearchRoomQueue.call.length).toStrictEqual(1)

  for (const [init, consume] of mocks) {
    expect(init.call.length).toStrictEqual(1)
    expect(consume.call.length).toStrictEqual(1)
  }
})

test('init twice', async () => {
  await init()
  await init()

  const general = await db.collections.rooms
    .find({ name: config.room.GENERAL_ROOM_NAME })
    .toArray()

  expect(general.length).toStrictEqual(1)
})
