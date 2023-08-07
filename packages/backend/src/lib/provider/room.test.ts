import { vi, test, expect, beforeEach } from 'vitest'
vi.mock('../logger')
vi.mock('../redis', () => {
  return {
    client: vi.fn(() => ({
      xadd: vi.fn()
    })),
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})
import { createXaddMock } from '../../../test/testUtil'
import { client, lock, release } from '../redis'
import * as types from '../../types'
import * as config from '../../config'

import * as room from './room'

beforeEach(() => {
  vi.clearAllMocks()
})

test('addInitializeSearchRoomQueue', async () => {
  const xadd = createXaddMock(client)
  const lockMock = vi.mocked(lock)
  lockMock.mockResolvedValue(true)
  const releaseMock = vi.mocked(release)

  await room.addInitializeSearchRoomQueue()

  expect(xadd).toHaveBeenCalledTimes(2)
  expect(releaseMock).toHaveBeenCalledTimes(2)

  expect(xadd.mock.calls[0][0]).toEqual(config.stream.ELASTICSEARCH_ROOMS)
  expect(xadd.mock.calls[0][4]).toEqual(types.RoomQueueType.INIT)

  expect(xadd.mock.calls[1][0]).toEqual(config.stream.JOB)
  expect(xadd.mock.calls[1][4]).toEqual(types.JobType.SEARCH_ROOM)
})

test('addInitializeSearchRoomQueue (locked)', async () => {
  const xadd = createXaddMock(client)
  const lockMock = vi.mocked(lock)
  lockMock.mockResolvedValue(false)
  const releaseMock = vi.mocked(release)

  await room.addInitializeSearchRoomQueue()

  expect(xadd.mock.calls.length).toBe(0)
  expect(releaseMock.mock.calls.length).toBe(0)
})

test('addSyncSearchRoomQueue', async () => {
  const xadd = createXaddMock(client)
  const lockMock = vi.mocked(lock)
  lockMock.mockResolvedValue(true)

  await room.addSyncSearchRoomQueue()

  expect(xadd.mock.calls.length).toBe(1)

  expect(xadd.mock.calls[0][0]).toEqual(config.stream.JOB)
  expect(xadd.mock.calls[0][4]).toEqual(types.JobType.SEARCH_ROOM)
})

test('addSyncSearchRoomQueue (locked)', async () => {
  const xadd = createXaddMock(client)
  const lockMock = vi.mocked(lock)
  lockMock.mockResolvedValueOnce(false)
  const releaseMock = vi.mocked(release)

  await room.addSyncSearchRoomQueue()

  expect(xadd.mock.calls.length).toBe(0)
  expect(releaseMock.mock.calls.length).toBe(0)
})
