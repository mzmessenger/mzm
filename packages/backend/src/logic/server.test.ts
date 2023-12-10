import { vi, test, expect, beforeAll } from 'vitest'
vi.mock('../lib/logger.js')
vi.mock('../lib/consumer/remove.js', () => {
  return {
    initRemoveConsumerGroup: vi.fn(),
    consumeRemove: vi.fn()
  }
})
vi.mock('../lib/consumer/unread.js', () => {
  return {
    initUnreadConsumerGroup: vi.fn(),
    consumeUnread: vi.fn()
  }
})
vi.mock('../lib/consumer/reply.js', () => {
  return {
    initReplyConsumerGroup: vi.fn(),
    consumeReply: vi.fn()
  }
})
vi.mock('../lib/consumer/search/room.js', () => {
  return {
    initSearchRoomConsumerGroup: vi.fn(),
    consumeSearchRooms: vi.fn()
  }
})
vi.mock('../lib/consumer/job.js', () => {
  return {
    initJobConsumerGroup: vi.fn(),
    consumeJob: vi.fn()
  }
})
vi.mock('../lib/consumer/vote.js', () => {
  return {
    initRenameConsumerGroup: vi.fn(),
    consumeVote: vi.fn()
  }
})
vi.mock('../lib/redis.js', () => {
  return {
    client: {
      xadd: vi.fn()
    },
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
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

import { init } from './server.js'
import { collections } from '../lib/db.js'
import * as config from '../config.js'
import * as consumerRemove from '../lib/consumer/remove.js'
import * as consumerUnread from '../lib/consumer/unread.js'
import * as consumeReply from '../lib/consumer/reply.js'
import * as consumeSearchRoom from '../lib/consumer/search/room.js'
import * as consumeJob from '../lib/consumer/job.js'
import * as consumeVote from '../lib/consumer/vote.js'
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

  const db = await getTestMongoClient(globalThis)
  const general = await collections(db)
    .rooms.find({ name: config.room.GENERAL_ROOM_NAME })
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

  const db = await getTestMongoClient(globalThis)
  const general = await collections(db)
    .rooms.find({ name: config.room.GENERAL_ROOM_NAME })
    .toArray()

  expect(general.length).toStrictEqual(1)
})
