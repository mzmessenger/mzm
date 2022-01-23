jest.mock('../logger')
jest.mock('../redis', () => {
  return {
    client: {
      xadd: jest.fn()
    },
    lock: jest.fn(() => Promise.resolve(true)),
    release: jest.fn()
  }
})
import { getMockType } from '../../../jest/testUtil'
import * as redis from '../redis'
import * as types from '../../types'
import * as config from '../../config'

const xadd = getMockType(redis.client.xadd)

import * as room from './room'

test('addInitializeSearchRoomQueue', async () => {
  xadd.mockClear()
  const lock = getMockType(redis.lock)
  lock.mockClear()
  lock.mockResolvedValue(true)
  const release = getMockType(redis.release)
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
  const lock = getMockType(redis.lock)
  lock.mockClear()
  lock.mockResolvedValue(false)
  const release = getMockType(redis.release)
  release.mockClear()

  await room.addInitializeSearchRoomQueue()

  expect(xadd.mock.calls.length).toBe(0)
  expect(release.mock.calls.length).toBe(0)
})

test('addSyncSearchRoomQueue', async () => {
  xadd.mockClear()
  const lock = getMockType(redis.lock)
  lock.mockClear()
  lock.mockResolvedValue(true)

  await room.addSyncSearchRoomQueue()

  expect(xadd.mock.calls.length).toBe(1)

  expect(xadd.mock.calls[0][0]).toEqual(config.stream.JOB)
  expect(xadd.mock.calls[0][4]).toEqual(types.JobType.SEARCH_ROOM)
})

test('addSyncSearchRoomQueue (locked)', async () => {
  xadd.mockClear()
  const lock = getMockType(redis.lock)
  lock.mockClear()
  lock.mockResolvedValueOnce(false)
  const release = getMockType(redis.release)
  release.mockClear()

  await room.addSyncSearchRoomQueue()

  expect(xadd.mock.calls.length).toBe(0)
  expect(release.mock.calls.length).toBe(0)
})
