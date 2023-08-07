import { vi, test, expect } from 'vitest'

vi.mock('../../logger')
vi.mock('../../redis', () => {
  return {
    client: vi.fn(() => ({
      xack: vi.fn()
    }))
  }
})
vi.mock('../common', () => {
  return {
    initConsumerGroup: vi.fn(),
    consumeGroup: vi.fn(),
    createParser: vi.fn()
  }
})
vi.mock('../../elasticsearch/rooms', () => {
  return {
    initAlias: vi.fn(),
    insertRooms: vi.fn()
  }
})

import { ObjectId } from 'mongodb'
import { createXackMock } from '../../../../test/testUtil'
import * as config from '../../../config'
import { RoomQueueType } from '../../../types'
import { client } from '../../redis'
import { initConsumerGroup, consumeGroup } from '../common'
import * as esLogic from '../../elasticsearch/rooms'
import {
  searchRooms,
  initSearchRoomConsumerGroup,
  consumeSearchRooms
} from './room'

test('initSearchRoomConsumerGroup', async () => {
  const init = vi.mocked(initConsumerGroup)

  await initSearchRoomConsumerGroup()

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][0]).toStrictEqual(config.stream.ELASTICSEARCH_ROOMS)
})

test('consumeSearchRooms', async () => {
  const consume = vi.mocked(consumeGroup)

  await consumeSearchRooms()

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][2]).toStrictEqual(
    config.stream.ELASTICSEARCH_ROOMS
  )
})

test.each([
  [RoomQueueType.INIT, esLogic.initAlias, [RoomQueueType.INIT]],
  [
    RoomQueueType.ROOM,
    esLogic.insertRooms,
    [
      RoomQueueType.ROOM,
      `["${new ObjectId().toHexString()}","${new ObjectId().toHexString()}"]`
    ]
  ]
])(`searchRooms: %s`, async (_type, logic, messages) => {
  const xack = createXackMock(client)
  xack.mockClear()
  xack.mockResolvedValue(1)

  const logicMock = vi.mocked(logic)
  logicMock.mockClear()

  await searchRooms('queue-id', messages)

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logicMock.mock.calls.length).toStrictEqual(1)
})

test('search no-type', async () => {
  const xack = createXackMock(client)
  xack.mockClear()
  xack.mockResolvedValue(1)

  const logic = vi.mocked(esLogic.initAlias)
  logic.mockClear()

  await searchRooms('queue-id', ['no-type'])

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logic.mock.calls.length).toStrictEqual(0)
})
