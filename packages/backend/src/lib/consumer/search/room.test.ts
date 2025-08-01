/* eslint-disable @typescript-eslint/ban-ts-comment, no-empty-pattern */
import { vi, test as baseTest, expect } from 'vitest'
import { getTestMongoClient } from '../../../../test/testUtil.js'

vi.mock('../../logger.js')
vi.mock('../../redis.js', () => {
  return {
    client: vi.fn(() => ({
      xack: vi.fn()
    }))
  }
})
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
import { client } from '../../redis.js'
import { initConsumerGroup, consumeGroup } from '../common.js'
import * as esLogic from '../../elasticsearch/rooms.js'
import {
  searchRooms,
  initSearchRoomConsumerGroup,
  consumeSearchRooms
} from './room.js'

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

test('initSearchRoomConsumerGroup', async () => {
  const init = vi.mocked(initConsumerGroup)

  await initSearchRoomConsumerGroup()

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][0]).toStrictEqual(config.stream.ELASTICSEARCH_ROOMS)
})

test('consumeSearchRooms', async ({ testDb }) => {
  const consume = vi.mocked(consumeGroup)

  await consumeSearchRooms(testDb)

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][2]).toStrictEqual(
    config.stream.ELASTICSEARCH_ROOMS
  )
})

test.for([
  [RoomQueueType.INIT, esLogic.initAlias, [RoomQueueType.INIT] satisfies string[]],
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
  // @ts-expect-error
  vi.mocked(client).mockImplementation(() => ({ xack }))
  xack.mockClear()
  xack.mockResolvedValue(1)

  const logicMock = vi.mocked(logic)
  logicMock.mockClear()

  await searchRooms(testDb, 'queue-id', messages)

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logicMock.mock.calls.length).toStrictEqual(1)
})

test('search no-type', async ({ testDb }) => {
  const xack = vi.fn()
  // @ts-expect-error
  vi.mocked(client).mockImplementation(() => ({ xack }))
  xack.mockClear()
  xack.mockResolvedValue(1)

  const logic = vi.mocked(esLogic.initAlias)
  logic.mockClear()

  await searchRooms(testDb, 'queue-id', ['no-type'])

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logic.mock.calls.length).toStrictEqual(0)
})
