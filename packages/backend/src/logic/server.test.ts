jest.mock('../lib/logger')
jest.mock('../lib/consumer/remove', () => {
  return {
    initRemoveConsumerGroup: jest.fn(),
    consumeRemove: jest.fn()
  }
})
jest.mock('../lib/consumer/unread', () => {
  return {
    initUnreadConsumerGroup: jest.fn(),
    consumeUnread: jest.fn()
  }
})
jest.mock('../lib/consumer/reply', () => {
  return {
    initReplyConsumerGroup: jest.fn(),
    consumeReply: jest.fn()
  }
})
jest.mock('../lib/consumer/search/room', () => {
  return {
    initSearchRoomConsumerGroup: jest.fn(),
    consumeSearchRooms: jest.fn()
  }
})
jest.mock('../lib/consumer/job', () => {
  return {
    initJobConsumerGroup: jest.fn(),
    consumeJob: jest.fn()
  }
})
jest.mock('../lib/consumer/vote', () => {
  return {
    initRenameConsumerGroup: jest.fn(),
    consumeVote: jest.fn()
  }
})
jest.mock('../lib/redis', () => {
  return {
    client: {
      xadd: jest.fn()
    },
    lock: jest.fn(() => Promise.resolve(true)),
    release: jest.fn()
  }
})
jest.mock('../lib/provider/index', () => {
  return {
    addInitializeSearchRoomQueue: jest.fn()
  }
})

import { mongoSetup, getMockType } from '../../jest/testUtil'
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

let mongoServer = null

beforeAll(async () => {
  const mongo = await mongoSetup()
  mongoServer = mongo.mongoServer
  return await db.connect(mongo.uri)
})

afterAll(async () => {
  await db.close()
  await mongoServer.stop()
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
    const initMock = getMockType(init)
    initMock.mockClear()
    initMock.mockResolvedValue('resolve init')
    const consumeMock = getMockType(consume)
    consumeMock.mockClear()
    consumeMock.mockResolvedValue('resolve consume')
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
