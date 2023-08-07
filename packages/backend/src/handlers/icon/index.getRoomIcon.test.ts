import { vi, test, expect, beforeEach } from 'vitest'
vi.mock('undici', () => {
  return { request: vi.fn() }
})
vi.mock('image-size')
vi.mock('../../lib/logger')
vi.mock('../../lib/storage')
vi.mock('../../lib/db.js', async () => {
  const { mockDb } = await import('../../../test/mock.js')
  return { ...(await mockDb(await vi.importActual('../../lib/db.js'))) }
})

import { Readable } from 'stream'
import { ObjectId } from 'mongodb'
import { createRequest, getTestMongoClient } from '../../../test/testUtil'
import { createHeadObjectMockValue, createGetObjectMockValue } from './testUtil'
import { collections, RoomStatusEnum } from '../../lib/db'
import * as storage from '../../lib/storage'
import { BadRequest, NotFound } from 'mzm-shared/lib/errors'
import { getRoomIcon } from './index'

const db = await getTestMongoClient()

beforeEach(() => {
  vi.resetAllMocks()
})

test('getRoomIcon', async () => {
  const roomId = new ObjectId()
  const name = roomId.toHexString()
  const version = '12345'

  await collections(db).rooms.insertOne({
    _id: roomId,
    name,
    createdBy: new ObjectId().toHexString(),
    updatedBy: undefined,
    icon: { key: 'iconkey', version },
    status: RoomStatusEnum.CLOSE
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

  await collections(db).rooms.insertOne({
    _id: roomId,
    name: name,
    createdBy: new ObjectId().toHexString(),
    icon: { key: 'iconkey', version },
    status: RoomStatusEnum.CLOSE
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

  await collections(db).rooms.insertOne({
    _id: roomId,
    name: name,
    createdBy: new ObjectId().toHexString(),
    icon: { key: 'iconkey', version },
    status: RoomStatusEnum.CLOSE
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
