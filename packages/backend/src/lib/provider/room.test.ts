import { vi, test, expect } from 'vitest'
vi.mock('../logger')
vi.mock('../redis', () => {
  return {
    client: {
      xadd: vi.fn()
    },
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})
import { createXaddMock } from '../../../test/testUtil'
import * as redis from '../redis'
import * as types from '../../types'
import * as config from '../../config'

const xadd = createXaddMock(redis.client.xadd)

import * as room from './room'

test('addInitializeSearchRoomQueue', async () => {
  xadd.mockClear()
  const lock = vi.mocked(redis.lock)
  lock.mockClear()
  lock.mockResolvedValue(true)
  const release = vi.mocked(redis.release)
  release.mockClear()

  await room.addInitializeSearchRoomQueue()

  expect(xadd.mock.calls.length).toBe(2)
  expect(release.mock.calls.length).toBe(2)

  expect(xadd.mock.calls[0][0]).toEqual(config.stream.ELASTICSEARCH_ROOMS)
  expect(xadd.mock.calls[0][4]).toEqual(types.RoomQueueType.INIT)

  expect(xadd.mock.calls[1][0]).toEqual(config.stream.JOB)
  expect(xadd.mock.calls[1][4]).toEqual(types.JobType.SEARCH_ROOM)
})

test('addInitializeSearchRoomQueue (locked)', async () => {
  xadd.mockClear()
  const lock = vi.mocked(redis.lock)
  lock.mockClear()
  lock.mockResolvedValue(false)
  const release = vi.mocked(redis.release)
  release.mockClear()

  await room.addInitializeSearchRoomQueue()

  expect(xadd.mock.calls.length).toBe(0)
  expect(release.mock.calls.length).toBe(0)
})

test('addSyncSearchRoomQueue', async () => {
  xadd.mockClear()
  const lock = vi.mocked(redis.lock)
  lock.mockClear()
  lock.mockResolvedValue(true)

  await room.addSyncSearchRoomQueue()

  expect(xadd.mock.calls.length).toBe(1)

  expect(xadd.mock.calls[0][0]).toEqual(config.stream.JOB)
  expect(xadd.mock.calls[0][4]).toEqual(types.JobType.SEARCH_ROOM)
})

test('addSyncSearchRoomQueue (locked)', async () => {
  xadd.mockClear()
  const lock = vi.mocked(redis.lock)
  lock.mockClear()
  lock.mockResolvedValueOnce(false)
  const release = vi.mocked(redis.release)
  release.mockClear()

  await room.addSyncSearchRoomQueue()

  expect(xadd.mock.calls.length).toBe(0)
  expect(release.mock.calls.length).toBe(0)
})
