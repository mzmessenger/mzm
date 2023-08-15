/* eslint-disable @typescript-eslint/ban-ts-comment */
import { vi, test, expect, beforeAll } from 'vitest'
vi.mock('undici', () => {
  return { request: vi.fn() }
})
vi.mock('../../lib/image.js')
vi.mock('../../lib/logger.js')
vi.mock('../../lib/storage.js')
vi.mock('../../lib/db.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/db.js')>(
    '../../lib/db.js'
  )
  return { ...actual, mongoClient: vi.fn() }
})

import type { IncomingHttpHeaders } from 'http'
import { Readable } from 'stream'
import { ObjectId, WithId } from 'mongodb'
import { request } from 'undici'
import { BadRequest, NotFound } from 'mzm-shared/lib/errors'
import {
  getTestMongoClient,
  createRequest,
  createFileRequest
} from '../../../test/testUtil.js'
import { collections, RoomStatusEnum, type User } from '../../lib/db.js'
import * as storage from '../../lib/storage.js'
import * as config from '../../config.js'
import * as icon from './index.js'
import { sizeOf } from '../../lib/image.js'

beforeAll(async () => {
  const { mongoClient } = await import('../../lib/db.js')
  const { getTestMongoClient } = await import('../../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

type ResponseBody = Awaited<ReturnType<typeof request>>['body']

const createHeadObjectMockValue = (options: {
  ETag: string
  ContentType: string
  ContentLength: number
  LastModified: Date
  CacheControl: string
}) => {
  const headers: Awaited<ReturnType<typeof storage.headObject>> = {
    ETag: options.ETag,
    ContentType: options.ContentType,
    ContentLength: options.ContentLength,
    LastModified: options.LastModified,
    CacheControl: options.CacheControl,
    // @ts-expect-error
    $response: undefined
  }

  return headers
}

const createGetObjectMockValue = (options: { createReadStream: Readable }) => {
  const getObject: Awaited<ReturnType<typeof storage.getObject>> = {
    createReadStream: () => options.createReadStream,
    // @ts-expect-error
    abort: undefined,
    // @ts-expect-error
    eachPage: undefined,
    // @ts-expect-error
    isPageable: undefined,
    // @ts-expect-error
    send: undefined,
    // @ts-expect-error
    on: undefined,
    // @ts-expect-error
    onAsync: undefined,
    // @ts-expect-error
    promise: undefined,
    // @ts-expect-error
    startTime: undefined,
    // @ts-expect-error
    httpRequest: undefined
  }

  return getObject
}

test('getUserIcon from storage', async () => {
  const userId = new ObjectId()
  const account = userId.toHexString()
  const version = '12345'

  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertOne({
    _id: userId,
    account,
    roomOrder: [],
    icon: { key: 'iconkey', version }
  })

  const req = createRequest(null, { params: { account, version } })

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

  const res = await icon.getUserIcon(req)

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

test.each([
  [null, '1234'], // no version
  ['1234', '4321'] // different version
])(
  'getUserIcon from identicon (user: %s, icon version: %s, request icon version: %s)',
  async (iconVersion, requestVersion) => {
    const id = new ObjectId()
    const account = id.toHexString()
    const user: WithId<User> = {
      _id: id,
      account,
      roomOrder: []
    }
    if (iconVersion) {
      user.icon = { key: 'iconkey', version: iconVersion }
    }
    const db = await getTestMongoClient(globalThis)
    await collections(db).users.insertOne(user)

    const headObjectMock = vi.mocked(storage.headObject).mockClear()
    const getObjectMock = vi.mocked(storage.getObject).mockClear()
    const requestMock = vi.mocked(request).mockClear()
    const headers: IncomingHttpHeaders = {
      ETag: 'etag',
      'content-type': 'image/png',
      'content-length': '12345',
      'Last-Modified': new Date(2020, 0, 1).toUTCString(),
      'Cache-Control': 'max-age=604800'
    } as const
    const readableStream = new Readable() as ResponseBody
    requestMock.mockResolvedValueOnce({
      headers,
      body: readableStream,
      statusCode: 200,
      // @ts-expect-error
      trailers: undefined,
      opaque: undefined,
      // @ts-expect-error
      context: undefined
    })

    const req = createRequest(null, {
      params: { account, version: requestVersion }
    })

    const res = await icon.getUserIcon(req)

    expect(headObjectMock.mock.calls.length).toStrictEqual(0)
    expect(getObjectMock.mock.calls.length).toStrictEqual(0)
    expect(requestMock.mock.calls.length).toStrictEqual(1)
    for (const [key, val] of Object.entries(headers)) {
      expect(res.headers[key]).toStrictEqual(val)
    }
    expect(res.stream).toStrictEqual(readableStream)
  }
)

test('getUserIcon from identicon: not found on storage', async () => {
  const id = new ObjectId()
  const account = id.toHexString()
  const user: WithId<User> = {
    _id: id,
    account,
    roomOrder: [],
    icon: {
      key: 'iconkey',
      version: '1234'
    }
  }
  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertOne(user)

  const headObjectMock = vi.mocked(storage.headObject)
  headObjectMock.mockRejectedValueOnce({ statusCode: 404 })
  const requestMock = vi.mocked(request)
  const headers: IncomingHttpHeaders = {
    ETag: 'etag',
    'Content-Type': 'image/png',
    'Content-Length': '12345',
    'Last-Modified': new Date(2020, 0, 1).toUTCString(),
    'Cache-Control': 'max-age=604800'
  } as const
  const readableStream = new Readable() as ResponseBody
  requestMock.mockResolvedValueOnce({
    headers,
    body: readableStream,
    statusCode: 200,
    // @ts-expect-error
    trailers: undefined,
    opaque: undefined,
    // @ts-expect-error
    context: undefined
  })

  const req = createRequest(null, {
    params: { account, version: user.icon?.version || '' }
  })

  const res = await icon.getUserIcon(req)

  expect(headObjectMock.mock.calls.length).toStrictEqual(1)
  expect(res.headers.ETag).toStrictEqual(headers.ETag)
  expect(res.headers['Content-Type']).toStrictEqual(headers['Content-Type'])
  expect(res.headers['Content-Length']).toStrictEqual(headers['Content-Length'])
  expect(res.headers['last-modified']).toStrictEqual(headers['last-modified'])
  expect(res.headers['Cache-Control']).toStrictEqual(headers['Cache-Control'])
  expect(res.stream).toStrictEqual(readableStream)
})

test('getUserIcon BadRequest: no account', async () => {
  expect.assertions(1)

  const version = '12345'

  const req = createRequest(null, { params: { account: '', version } })

  try {
    await icon.getUserIcon(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('uploadUserIcon', async () => {
  const userId = new ObjectId()

  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertOne({
    _id: userId,
    account: userId.toString(),
    roomOrder: []
  })

  const putObjectMock = vi.mocked(storage.putObject)
  putObjectMock.mockResolvedValueOnce({} as never)

  vi.mocked(sizeOf).mockImplementationOnce(() => {
    return Promise.resolve({ width: 100, height: 100 })
  })
  const createBodyFromFilePath = vi.mocked(storage.createBodyFromFilePath)
  const readableStream = new Readable() as ReturnType<
    typeof storage.createBodyFromFilePath
  >
  createBodyFromFilePath.mockReturnValue(readableStream)

  const file = {
    key: 'filekey',
    mimetype: 'image/png',
    originalname: 'fileoriginalname.png',
    size: 1,
    filename: 'filename.png',
    path: '/path/to/file'
  }

  const req = createFileRequest(userId, { file })

  const res = await icon.uploadUserIcon(req)

  const user = await collections(db).users.findOne({ _id: userId })

  expect(typeof user?.icon?.version).toStrictEqual('string')
  expect(res.version).toStrictEqual(user?.icon?.version)
})

test.each([['image/gif'], ['image/svg+xml']])(
  'uploadUserIcon: fail file type (%s)',
  async (mimetype) => {
    expect.assertions(1)

    const userId = new ObjectId()

    const file = {
      key: 'filekey',
      mimetype: mimetype,
      originalname: 'fileoriginalname.png',
      size: 1,
      filename: 'filename.png',
      path: '/path/to/file'
    }

    const req = createFileRequest(userId, { file })

    try {
      await icon.uploadUserIcon(req)
    } catch (e) {
      expect(e instanceof BadRequest).toStrictEqual(true)
    }
  }
)

test('uploadUserIcon validation: size over', async () => {
  expect.assertions(1)

  const userId = new ObjectId()

  const file = {
    key: 'filekey',
    mimetype: 'image/png',
    originalname: 'fileoriginalname.png',
    size: 1,
    filename: 'filename.png',
    path: '/path/to/file'
  }

  vi.mocked(sizeOf).mockImplementationOnce(() => {
    return Promise.resolve({
      width: config.icon.MAX_USER_ICON_SIZE + 1,
      height: config.icon.MAX_USER_ICON_SIZE + 1
    })
  })

  const req = createFileRequest(userId, { file })

  try {
    await icon.uploadUserIcon(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('uploadUserIcon validation: not square', async () => {
  expect.assertions(1)

  const userId = new ObjectId()

  const file = {
    key: 'filekey',
    mimetype: 'image/png',
    originalname: 'fileoriginalname.png',
    size: 1,
    filename: 'filename.png',
    path: '/path/to/file'
  }

  vi.mocked(sizeOf).mockImplementation(() => {
    return Promise.resolve({
      width: config.icon.MAX_USER_ICON_SIZE - 1,
      height: config.icon.MAX_USER_ICON_SIZE - 2
    })
  })

  const req = createFileRequest(userId, { file })

  try {
    await icon.uploadUserIcon(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('getRoomIcon', async () => {
  const roomId = new ObjectId()
  const name = roomId.toHexString()
  const version = '12345'

  const db = await getTestMongoClient(globalThis)
  await collections(db).rooms.insertOne({
    _id: roomId,
    name,
    // @ts-expect-error
    createdBy: null,
    // @ts-expect-error
    updatedBy: null,
    icon: { key: 'iconkey', version },
    status: RoomStatusEnum.CLOSE
  })

  const req = createRequest(null, { params: { roomname: name, version } })

  const headObjectMock = vi.mocked(storage.headObject).mockClear()
  const headers = createHeadObjectMockValue({
    ETag: 'etag',
    ContentType: 'image/png',
    ContentLength: 12345,
    LastModified: new Date(2020, 0, 1),
    CacheControl: 'max-age=604800'
  })
  headObjectMock.mockResolvedValueOnce(headers)
  const getObjectMock = vi.mocked(storage.getObject).mockClear()
  const readableStream = new Readable()
  const getObject = createGetObjectMockValue({
    createReadStream: readableStream
  })
  getObjectMock.mockReturnValueOnce(getObject)

  const res = await icon.getRoomIcon(req)

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
    await icon.getRoomIcon(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('getRoomIcon NotFound: different version', async () => {
  expect.assertions(1)

  const roomId = new ObjectId()
  const name = roomId.toHexString()
  const version = '12345'

  const db = await getTestMongoClient(globalThis)
  await collections(db).rooms.insertOne({
    _id: roomId,
    name: name,
    // @ts-expect-error
    createdBy: null,
    icon: { key: 'iconkey', version },
    status: RoomStatusEnum.CLOSE
  })

  const req = createRequest(null, {
    params: { roomname: name, version: '54321' }
  })

  try {
    await icon.getRoomIcon(req)
  } catch (e) {
    expect(e instanceof NotFound).toStrictEqual(true)
  }
})

test('getRoomIcon NotFound: not found on storage', async () => {
  expect.assertions(1)

  const roomId = new ObjectId()
  const name = roomId.toHexString()
  const version = '12345'

  const db = await getTestMongoClient(globalThis)
  await collections(db).rooms.insertOne({
    _id: roomId,
    name: name,
    // @ts-expect-error
    createdBy: null,
    icon: { key: 'iconkey', version },
    status: RoomStatusEnum.CLOSE
  })

  const headObjectMock = vi.mocked(storage.headObject)
  headObjectMock.mockRejectedValueOnce({ statusCode: 404 })

  const req = createRequest(null, {
    params: { roomname: name, version: version }
  })

  try {
    await icon.getRoomIcon(req)
  } catch (e) {
    expect(e instanceof NotFound).toStrictEqual(true)
  }
})

test('uploadRoomIcon', async () => {
  const roomId = new ObjectId()
  const name = roomId.toHexString()

  const db = await getTestMongoClient(globalThis)
  await collections(db).rooms.insertOne({
    _id: roomId,
    name,
    // @ts-expect-error
    createdBy: null,
    status: RoomStatusEnum.CLOSE
  })

  const putObjectMock = vi.mocked(storage.putObject)
  putObjectMock.mockResolvedValueOnce({} as never)

  vi.mocked(sizeOf).mockImplementation(() => {
    return Promise.resolve({
      width: config.icon.MAX_USER_ICON_SIZE,
      height: config.icon.MAX_USER_ICON_SIZE
    })
  })
  const createBodyFromFilePath = vi.mocked(storage.createBodyFromFilePath)
  const readableStream = new Readable() as ReturnType<
    typeof storage.createBodyFromFilePath
  >
  createBodyFromFilePath.mockReturnValue(readableStream)

  const file = {
    key: 'filekey',
    mimetype: 'image/png',
    originalname: 'fileoriginalname.png',
    size: 1,
    filename: 'filename.png',
    path: '/path/to/file'
  }

  const req = createFileRequest(new ObjectId(), {
    file,
    params: { roomname: name }
  })

  const res = await icon.uploadRoomIcon(req)

  const room = await collections(db).rooms.findOne({ _id: roomId })

  expect(typeof room?.icon?.version).toStrictEqual('string')
  expect(res.version).toStrictEqual(room?.icon?.version)
})

test.each([['image/gif'], ['image/svg+xml']])(
  'uploadRoomIcon: fail file type (%s)',
  async (mimetype) => {
    expect.assertions(1)

    const name = new ObjectId().toHexString()

    const file = {
      key: 'filekey',
      mimetype: mimetype,
      originalname: 'fileoriginalname.png',
      size: 1,
      filename: 'filename.png',
      path: '/path/to/file'
    }

    const req = createFileRequest(new ObjectId(), {
      file,
      params: { roomname: name }
    })

    try {
      await icon.uploadRoomIcon(req)
    } catch (e) {
      expect(e instanceof BadRequest).toStrictEqual(true)
    }
  }
)

test('uploadRoomIcon: validation: size over ', async () => {
  expect.assertions(1)

  const file = {
    key: 'filekey',
    mimetype: 'image/png',
    originalname: 'fileoriginalname.png',
    size: 1,
    filename: 'filename.png',
    path: '/path/to/file'
  }

  vi.mocked(sizeOf).mockImplementationOnce(() => {
    return Promise.resolve({
      width: config.icon.MAX_ROOM_ICON_SIZE + 1,
      height: config.icon.MAX_ROOM_ICON_SIZE + 1
    })
  })

  const req = createFileRequest(new ObjectId(), { file })

  try {
    await icon.uploadRoomIcon(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('uploadUserIcon validation: not square', async () => {
  expect.assertions(1)

  const userId = new ObjectId()

  const file = {
    key: 'filekey',
    mimetype: 'image/png',
    originalname: 'fileoriginalname.png',
    size: 1,
    filename: 'filename.png',
    path: '/path/to/file'
  }

  vi.mocked(sizeOf).mockImplementation(() => {
    return Promise.resolve({
      width: config.icon.MAX_ROOM_ICON_SIZE - 1,
      height: config.icon.MAX_ROOM_ICON_SIZE - 2
    })
  })

  const req = createFileRequest(userId, { file })

  try {
    await icon.uploadUserIcon(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
