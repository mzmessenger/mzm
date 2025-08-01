/* eslint-disable @typescript-eslint/ban-ts-comment, no-empty-pattern  */
import { vi, test as baseTest, expect } from 'vitest'
import { getTestMongoClient } from '../../../test/testUtil.js'
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

import * as config from '../../config.js'
import { JobType } from '../../types.js'
import { client } from '../redis.js'
import { syncSeachAllRooms } from '../../logic/rooms.js'
import { initConsumerGroup, consumeGroup } from './common.js'
import { job, initJobConsumerGroup, consumeJob } from './job.js'

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

test('initJobConsumerGroup', async () => {
  const init = vi.mocked(initConsumerGroup)

  await initJobConsumerGroup()

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][0]).toStrictEqual(config.stream.JOB)
})

test('consumeJob', async ({ testDb }) => {
  const consume = vi.mocked(consumeGroup)

  await consumeJob(testDb)

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][2]).toStrictEqual(config.stream.JOB)
})

test(`job: ${JobType.SEARCH_ROOM}`, async ({ testDb }) => {
  const xack = vi.fn()
  // @ts-expect-error
  vi.mocked(client).mockImplementation(() => ({ xack }))
  xack.mockClear()
  xack.mockResolvedValue(1)

  const logic = vi.mocked(syncSeachAllRooms)
  logic.mockClear()

  await job(testDb, 'queue-id', [JobType.SEARCH_ROOM])

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logic.mock.calls.length).toStrictEqual(1)
})

test('job no-type', async ({ testDb }) => {
  const xack = vi.fn()
  // @ts-expect-error
  vi.mocked(client).mockImplementation(() => ({ xack }))
  xack.mockClear()
  xack.mockResolvedValue(1)

  const logic = vi.mocked(syncSeachAllRooms)
  logic.mockClear()

  await job(testDb, 'queue-id', ['no-type'])

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
  expect(logic.mock.calls.length).toStrictEqual(0)
})
