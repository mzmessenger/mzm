import { vi, expect } from 'vitest'
import { createTest } from '../../../../test/testUtil.js'

vi.mock('../../logger.js')
vi.mock('../common.js', () => {
  return {
    initConsumerGroup: vi.fn(),
    consumeGroup: vi.fn(),
    createParser: vi.fn()
  }
})
vi.mock('../../elasticsearch/rooms.js', () => {
  return {
    initAlias: vi.fn(),
    insertRooms: vi.fn()
  }
})

import { ObjectId } from 'mongodb'
import * as config from '../../../config.js'
import { RoomQueueType } from '../../../types.js'
import { type ExRedisClient } from '../../redis.js'
import { initConsumerGroup, consumeGroup } from '../common.js'
import * as esLogic from '../../elasticsearch/rooms.js'
import {
  searchRooms,
  initSearchRoomConsumerGroup,
  consumeSearchRooms
} from './room.js'

const test = await createTest(globalThis)

test('initSearchRoomConsumerGroup', async ({ testRedis }) => {
  const init = vi.mocked(initConsumerGroup)

  await initSearchRoomConsumerGroup(testRedis)

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][1]).toStrictEqual(config.stream.ELASTICSEARCH_ROOMS)
})

test('consumeSearchRooms', async ({ testDb, testRedis }) => {
  const consume = vi.mocked(consumeGroup)

  await consumeSearchRooms({ db: testDb, redis: testRedis })

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][3]).toStrictEqual(
    config.stream.ELASTICSEARCH_ROOMS
  )
})

test.for([
  [
    RoomQueueType.INIT,
    esLogic.initAlias,
    [RoomQueueType.INIT] satisfies string[]
  ],
  [
    RoomQueueType.ROOM,
    esLogic.insertRooms,
    [
      RoomQueueType.ROOM,
      `["${new ObjectId().toHexString()}","${new ObjectId().toHexString()}"]`
    ] satisfies string[]
  ]
] as const)(`searchRooms: %s`, async ([, logic, messages], { testDb }) => {
  const xack = vi.fn()
  xack.mockClear()
  xack.mockResolvedValue(1)
  const redis = { xack } as unknown as ExRedisClient

  const logicMock = vi.mocked(logic)
  logicMock.mockClear()

  await searchRooms({
    db: testDb,
    redis,
    ackId: 'queue-id',
    messages
  })

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logicMock.mock.calls.length).toStrictEqual(1)
})

test('search no-type', async ({ testDb }) => {
  const xack = vi.fn()
  xack.mockClear()
  xack.mockResolvedValue(1)
  const redis = { xack } as unknown as ExRedisClient

  const logic = vi.mocked(esLogic.initAlias)
  logic.mockClear()

  await searchRooms({
    db: testDb,
    redis,
    ackId: 'queue-id',
    messages: ['no-type']
  })

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logic.mock.calls.length).toStrictEqual(0)
})
