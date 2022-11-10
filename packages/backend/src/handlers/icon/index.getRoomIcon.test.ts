import type { MongoMemoryServer } from 'mongodb-memory-server'
import { vi, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
vi.mock('undici', () => {
  return { request: vi.fn() }
})
vi.mock('image-size')
vi.mock('../../lib/logger')
vi.mock('../../lib/storage')

import { Readable } from 'stream'
import { ObjectId } from 'mongodb'
import { mongoSetup, createRequest } from '../../../test/testUtil'
import { createHeadObjectMockValue, createGetObjectMockValue } from './testUtil'
import * as db from '../../lib/db'
import * as storage from '../../lib/storage'
import { BadRequest, NotFound } from '../../lib/errors'
import { getRoomIcon } from './index'

let mongoServer: MongoMemoryServer | null = null

beforeAll(async () => {
  const mongo = await mongoSetup()
  mongoServer = mongo.mongoServer
  await db.connect(mongo.uri)
})

beforeEach(() => {
  vi.resetAllMocks()
})

afterAll(async () => {
  await db.close()
  await mongoServer?.stop()
})

test('getRoomIcon', async () => {
  const roomId = new ObjectId()
  const name = roomId.toHexString()
  const version = '12345'

  await db.collections.rooms.insertOne({
    _id: roomId,
    name,
    createdBy: new ObjectId().toHexString(),
    updatedBy: undefined,
    icon: { key: 'iconkey', version },
    status: db.RoomStatusEnum.CLOSE
  })

  const req = createRequest(null, { params: { roomname: name, version } })

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
    createReadStream: readableStream
  })
  getObjectMock.mockReturnValueOnce(getObject)

  const res = await getRoomIcon(req)

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

test('getRoomIcon BadRequest: no room name', async () => {
  expect.assertions(1)

  const version = '12345'

  const req = createRequest(null, { params: { roomname: '', version } })

  try {
    await getRoomIcon(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('getRoomIcon NotFound: different version', async () => {
  expect.assertions(1)

  const roomId = new ObjectId()
  const name = roomId.toHexString()
  const version = '12345'

  await db.collections.rooms.insertOne({
    _id: roomId,
    name: name,
    createdBy: new ObjectId().toHexString(),
    icon: { key: 'iconkey', version },
    status: db.RoomStatusEnum.CLOSE
  })

  const req = createRequest(null, {
    params: { roomname: name, version: '54321' }
  })

  try {
    await getRoomIcon(req)
  } catch (e) {
    expect(e instanceof NotFound).toStrictEqual(true)
  }
})

test('getRoomIcon NotFound: not found on storage', async () => {
  expect.assertions(1)

  const roomId = new ObjectId()
  const name = roomId.toHexString()
  const version = '12345'

  await db.collections.rooms.insertOne({
    _id: roomId,
    name: name,
    createdBy: new ObjectId().toHexString(),
    icon: { key: 'iconkey', version },
    status: db.RoomStatusEnum.CLOSE
  })

  const headObjectMock = vi.mocked(storage.headObject)
  headObjectMock.mockRejectedValueOnce({ statusCode: 404 })

  const req = createRequest(null, {
    params: { roomname: name, version: version }
  })

  try {
    await getRoomIcon(req)
  } catch (e) {
    expect(e instanceof NotFound).toStrictEqual(true)
  }
})
