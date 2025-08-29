/* eslint-disable no-empty-pattern */
import { vi, test as baseTest, expect } from 'vitest'
vi.mock('undici', () => {
  return { request: vi.fn() }
})
vi.mock('image-size')
vi.mock('../../lib/logger.js')
vi.mock('../../lib/storage.js')
vi.mock('../../lib/db.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/db.js')>('../../lib/db.js')
  return { ...actual, mongoClient: vi.fn() }
})

import { Readable } from 'stream'
import { ObjectId } from 'mongodb'
import { BadRequest, NotFound } from 'mzm-shared/src/lib/errors'
import { getTestMongoClient } from '../../../test/testUtil.js'
import {
  createHeadObjectMockValue,
  createGetObjectMockValue
} from './testUtil.js'
import { collections, RoomStatusEnum } from '../../lib/db.js'
import * as storage from '../../lib/storage.js'
import { getRoomIcon } from './index.js'

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

test('getRoomIcon', async ({ testDb }) => {
  const roomId = new ObjectId()
  const roomName = roomId.toHexString()
  const version = '12345'

  const db = await getTestMongoClient(globalThis)
  await collections(db).rooms.insertOne({
    _id: roomId,
    name: roomName,
    createdBy: new ObjectId().toHexString(),
    updatedBy: undefined,
    icon: { key: 'iconkey', version },
    status: RoomStatusEnum.CLOSE
  })

  const headObjectMock = vi.mocked(storage.headObject)
  const headers = createHeadObjectMockValue({
    ETag: 'etag',
    ContentType: 'image/png',
    ContentLength: 12345,
    LastModified: new Date(2020, 0, 1),
    CacheControl: 'max-age=604800'
  })
  headObjectMock.mockResolvedValueOnce(headers)
  const getObjectMock = vi.mocked(storage.getObject)
  const readableStream = new Readable()
  const getObject = createGetObjectMockValue({
    Body: readableStream
  })
  getObjectMock.mockReturnValueOnce(getObject)

  const res = await getRoomIcon(testDb, { roomName, version })

  expect(headObjectMock.mock.calls.length).toStrictEqual(1)
  expect(getObjectMock.mock.calls.length).toStrictEqual(1)
  expect(res.headers.ETag).toStrictEqual(headers.ETag)
  expect(res.headers['content-type']).toStrictEqual(headers.ContentType)
  expect(res.headers['content-length']).toStrictEqual(
    `${headers.ContentLength}`
  )
  expect(res.headers['last-modified']).toStrictEqual(
    headers.LastModified?.toUTCString()
  )
  expect(res.headers['cache-control']).toStrictEqual(headers.CacheControl)
  expect(res.stream).toStrictEqual(readableStream)
})

test('getRoomIcon BadRequest: no room name', async ({ testDb }) => {
  expect.assertions(1)

  try {
    await getRoomIcon(testDb, { roomName: '', version: '12345' })
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('getRoomIcon NotFound: different version', async ({ testDb }) => {
  expect.assertions(1)

  const roomId = new ObjectId()
  const roomName = roomId.toHexString()
  const version = '12345'

  const db = await getTestMongoClient(globalThis)
  await collections(db).rooms.insertOne({
    _id: roomId,
    name: roomName,
    createdBy: new ObjectId().toHexString(),
    icon: { key: 'iconkey', version },
    status: RoomStatusEnum.CLOSE
  })

  try {
    await getRoomIcon(testDb, { roomName, version: '54321' })
  } catch (e) {
    expect(e instanceof NotFound).toStrictEqual(true)
  }
})

test('getRoomIcon NotFound: not found on storage', async ({ testDb }) => {
  expect.assertions(1)

  const roomId = new ObjectId()
  const roomName = roomId.toHexString()
  const version = '12345'

  const db = await getTestMongoClient(globalThis)
  await collections(db).rooms.insertOne({
    _id: roomId,
    name: roomName,
    createdBy: new ObjectId().toHexString(),
    icon: { key: 'iconkey', version },
    status: RoomStatusEnum.CLOSE
  })

  const headObjectMock = vi.mocked(storage.headObject)
  headObjectMock.mockRejectedValueOnce({ statusCode: 404 })

  try {
    await getRoomIcon(testDb, { roomName, version })
  } catch (e) {
    expect(e instanceof NotFound).toStrictEqual(true)
  }
})
