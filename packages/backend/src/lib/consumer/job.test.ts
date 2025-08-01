import { vi, expect } from 'vitest'
import { createTest } from '../../../test/testUtil.js'
vi.mock('../logger.js')

vi.mock('../../logic/rooms.js')
vi.mock('./common.js', () => {
  return {
    initConsumerGroup: vi.fn(),
    consumeGroup: vi.fn(),
    createParser: vi.fn()
  }
})

import * as config from '../../config.js'
import { JobType } from '../../types.js'
import { type ExRedisClient } from '../redis.js'
import { syncSeachAllRooms } from '../../logic/rooms.js'
import { initConsumerGroup, consumeGroup } from './common.js'
import { job, initJobConsumerGroup, consumeJob } from './job.js'

const test = await createTest(globalThis)

test('initJobConsumerGroup', async ({ testRedis }) => {
  const init = vi.mocked(initConsumerGroup)

  await initJobConsumerGroup(testRedis)

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][1]).toStrictEqual(config.stream.JOB)
})

test('consumeJob', async ({ testDb, testRedis }) => {
  const consume = vi.mocked(consumeGroup)

  await consumeJob({ db: testDb, redis: testRedis })

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][3]).toStrictEqual(config.stream.JOB)
})

test(`job: ${JobType.SEARCH_ROOM}`, async ({ testDb }) => {
  const xack = vi.fn()
  xack.mockClear()
  xack.mockResolvedValue(1)
  const redis = { xack } as unknown as ExRedisClient

  const logic = vi.mocked(syncSeachAllRooms)
  logic.mockClear()

  await job({
    db: testDb,
    redis,
    ackId: 'queue-id',
    messages: [JobType.SEARCH_ROOM]
  })

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logic.mock.calls.length).toStrictEqual(1)
})

test('job no-type', async ({ testDb }) => {
  const xack = vi.fn()
  xack.mockClear()
  xack.mockResolvedValue(1)
  const redis = { xack } as unknown as ExRedisClient

  const logic = vi.mocked(syncSeachAllRooms)
  logic.mockClear()

  await job({ db: testDb, redis, ackId: 'queue-id', messages: ['no-type'] })

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logic.mock.calls.length).toStrictEqual(0)
})
