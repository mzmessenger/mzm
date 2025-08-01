import { vi, expect, beforeEach } from 'vitest'
import { createTest } from '../../../test/testUtil.js'
vi.mock('../logger.js')
vi.mock('../redis.js', () => {
  return {
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})

import { type ExRedisClient, lock, release } from '../redis.js'
import * as types from '../../types.js'
import * as config from '../../config.js'
import * as room from './room.js'

const test = await createTest(globalThis)

beforeEach(() => {
  vi.clearAllMocks()
})

test('addInitializeSearchRoomQueue', async () => {
  const xadd = vi.fn()
  const redis = { xadd } as unknown as ExRedisClient

  const lockMock = vi.mocked(lock)
  lockMock.mockResolvedValue(true)
  const releaseMock = vi.mocked(release)

  await room.addInitializeSearchRoomQueue(redis)

  expect(xadd).toHaveBeenCalledTimes(2)
  expect(releaseMock).toHaveBeenCalledTimes(2)

  expect(xadd.mock.calls[0][0]).toEqual(config.stream.ELASTICSEARCH_ROOMS)
  expect(xadd.mock.calls[0][4]).toEqual(types.RoomQueueType.INIT)

  expect(xadd.mock.calls[1][0]).toEqual(config.stream.JOB)
  expect(xadd.mock.calls[1][4]).toEqual(types.JobType.SEARCH_ROOM)
})

test('addInitializeSearchRoomQueue (locked)', async () => {
  const xadd = vi.fn()
  const redis = { xadd } as unknown as ExRedisClient
  const lockMock = vi.mocked(lock)
  lockMock.mockResolvedValue(false)
  const releaseMock = vi.mocked(release)

  await room.addInitializeSearchRoomQueue(redis)

  expect(xadd.mock.calls.length).toBe(0)
  expect(releaseMock.mock.calls.length).toBe(0)
})

test('addSyncSearchRoomQueue', async () => {
  const xadd = vi.fn()
  const redis = { xadd } as unknown as ExRedisClient
  const lockMock = vi.mocked(lock)
  lockMock.mockResolvedValue(true)

  await room.addSyncSearchRoomQueue(redis)

  expect(xadd.mock.calls.length).toBe(1)

  expect(xadd.mock.calls[0][0]).toEqual(config.stream.JOB)
  expect(xadd.mock.calls[0][4]).toEqual(types.JobType.SEARCH_ROOM)
})

test('addSyncSearchRoomQueue (locked)', async () => {
  const xadd = vi.fn()
  const redis = { xadd } as unknown as ExRedisClient
  const lockMock = vi.mocked(lock)
  lockMock.mockResolvedValueOnce(false)
  const releaseMock = vi.mocked(release)

  await room.addSyncSearchRoomQueue(redis)

  expect(xadd.mock.calls.length).toBe(0)
  expect(releaseMock.mock.calls.length).toBe(0)
})
