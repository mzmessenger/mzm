jest.mock('../../logger')
jest.mock('../../redis', () => {
  return {
    client: {
      xack: jest.fn()
    }
  }
})
jest.mock('../common', () => {
  return {
    initConsumerGroup: jest.fn(),
    consumeGroup: jest.fn(),
    createParser: jest.fn()
  }
})
jest.mock('../../elasticsearch/rooms', () => {
  return {
    initAlias: jest.fn(),
    insertRooms: jest.fn()
  }
})

import { ObjectId } from 'mongodb'
import { createXackMock } from '../../../../jest/testUtil'
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
  const init = jest.mocked(initConsumerGroup)

  await initSearchRoomConsumerGroup()

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][0]).toStrictEqual(config.stream.ELASTICSEARCH_ROOMS)
})

test('consumeSearchRooms', async () => {
  const consume = jest.mocked(consumeGroup)

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
  const xack = createXackMock(client.xack)
  xack.mockClear()
  xack.mockResolvedValue(1)

  const logicMock = jest.mocked(logic)
  logicMock.mockClear()

  await searchRooms('queue-id', messages)

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logicMock.mock.calls.length).toStrictEqual(1)
})

test('search no-type', async () => {
  const xack = createXackMock(client.xack)
  xack.mockClear()
  xack.mockResolvedValue(1)

  const logic = jest.mocked(esLogic.initAlias)
  logic.mockClear()

  await searchRooms('queue-id', ['no-type'])

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logic.mock.calls.length).toStrictEqual(0)
})
