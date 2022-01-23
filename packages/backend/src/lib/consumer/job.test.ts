jest.mock('../logger')
jest.mock('../redis', () => {
  return {
    client: {
      xack: jest.fn()
    }
  }
})
jest.mock('../../logic/rooms')
jest.mock('./common', () => {
  return {
    initConsumerGroup: jest.fn(),
    consumeGroup: jest.fn(),
    createParser: jest.fn()
  }
})

import { getMockType } from '../../../jest/testUtil'
import * as config from '../../config'
import { JobType } from '../../types'
import { client } from '../redis'
import { syncSeachAllRooms } from '../../logic/rooms'
import { initConsumerGroup, consumeGroup } from './common'
import { job, initJobConsumerGroup, consumeJob } from './job'

test('initJobConsumerGroup', async () => {
  const init = getMockType(initConsumerGroup)

  await initJobConsumerGroup()

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][0]).toStrictEqual(config.stream.JOB)
})

test('consumeJob', async () => {
  const consume = getMockType(consumeGroup)

  await consumeJob()

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][2]).toStrictEqual(config.stream.JOB)
})

test(`job: ${JobType.SEARCH_ROOM}`, async () => {
  const xack = getMockType(client.xack)
  xack.mockClear()
  xack.mockResolvedValue('resolve')

  const logic = getMockType(syncSeachAllRooms)
  logic.mockClear()

  await job('queue-id', [JobType.SEARCH_ROOM])

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logic.mock.calls.length).toStrictEqual(1)
})

test('job no-type', async () => {
  const xack = getMockType(client.xack)
  xack.mockClear()
  xack.mockResolvedValue('resolve')

  const logic = getMockType(syncSeachAllRooms)
  logic.mockClear()

  await job('queue-id', ['no-type'])

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logic.mock.calls.length).toStrictEqual(0)
})
