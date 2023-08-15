import { vi, test, expect } from 'vitest'
vi.mock('../logger.js')

vi.mock('../redis.js', () => {
  return {
    client: vi.fn(() => ({
      xack: vi.fn()
    }))
  }
})
vi.mock('../../logic/rooms.js')
vi.mock('./common.js', () => {
  return {
    initConsumerGroup: vi.fn(),
    consumeGroup: vi.fn(),
    createParser: vi.fn()
  }
})

import { createXackMock } from '../../../test/testUtil.js'
import * as config from '../../config.js'
import { JobType } from '../../types.js'
import { client } from '../redis.js'
import { syncSeachAllRooms } from '../../logic/rooms.js'
import { initConsumerGroup, consumeGroup } from './common.js'
import { job, initJobConsumerGroup, consumeJob } from './job.js'

test('initJobConsumerGroup', async () => {
  const init = vi.mocked(initConsumerGroup)

  await initJobConsumerGroup()

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][0]).toStrictEqual(config.stream.JOB)
})

test('consumeJob', async () => {
  const consume = vi.mocked(consumeGroup)

  await consumeJob()

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][2]).toStrictEqual(config.stream.JOB)
})

test(`job: ${JobType.SEARCH_ROOM}`, async () => {
  const xack = createXackMock(client)
  xack.mockClear()
  xack.mockResolvedValue(1)

  const logic = vi.mocked(syncSeachAllRooms)
  logic.mockClear()

  await job('queue-id', [JobType.SEARCH_ROOM])

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logic.mock.calls.length).toStrictEqual(1)
})

test('job no-type', async () => {
  const xack = createXackMock(client)
  xack.mockClear()
  xack.mockResolvedValue(1)

  const logic = vi.mocked(syncSeachAllRooms)
  logic.mockClear()

  await job('queue-id', ['no-type'])

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logic.mock.calls.length).toStrictEqual(0)
})
