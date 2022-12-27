/* eslint-disable @typescript-eslint/ban-ts-comment */
import { vi, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
vi.mock('undici', () => {
  return { request: vi.fn() }
})
vi.mock('image-size')
vi.mock('../lib/logger')
vi.mock('../lib/storage')

import { Readable } from 'stream'
import type { IncomingHttpHeaders } from 'http'
import type { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId, WithId } from 'mongodb'
import { request } from 'undici'
import sizeOf from 'image-size'
import {
  mongoSetup,
  createRequest,
  createFileRequest
} from '../../test/testUtil'
import * as db from '../lib/db'
import * as storage from '../lib/storage'
import * as config from '../config'
import { BadRequest, NotFound } from '../lib/errors'
import * as icon from './icon'

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

test('getUserIcon from storage', async () => {
  const userId = new ObjectId()
  const account = userId.toHexString()
  const version = '12345'

  await db.collections.users.insertOne({
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
    const user: WithId<db.User> = {
      _id: id,
      account,
      roomOrder: []
    }
    if (iconVersion) {
      user.icon = { key: 'iconkey', version: iconVersion }
    }
    await db.collections.users.insertOne(user)

    const headObjectMock = vi.mocked(storage.headObject)
    const getObjectMock = vi.mocked(storage.getObject)
    const requestMock = vi.mocked(request)
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
  const user: WithId<db.User> = {
    _id: id,
    account,
    roomOrder: [],
    icon: {
      key: 'iconkey',
      version: '1234'
    }
  }
  await db.collections.users.insertOne(user)

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

  await db.collections.users.insertOne({
    _id: userId,
    account: userId.toString(),
    roomOrder: []
  })

  const putObjectMock = vi.mocked(storage.putObject)
  putObjectMock.mockResolvedValueOnce({} as never)

  const sizeOfMock = vi.mocked(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, { width: 100, height: 100 })
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

  const user = await db.collections.users.findOne({ _id: userId })

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

  const sizeOfMock = vi.mocked(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, {
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

  const sizeOfMock = vi.mocked(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, {
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

  await db.collections.rooms.insertOne({
    _id: roomId,
    name,
    // @ts-expect-error
    createdBy: null,
    // @ts-expect-error
    updatedBy: null,
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

  await db.collections.rooms.insertOne({
    _id: roomId,
    name: name,
    // @ts-expect-error
    createdBy: null,
    icon: { key: 'iconkey', version },
    status: db.RoomStatusEnum.CLOSE
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

  await db.collections.rooms.insertOne({
    _id: roomId,
    name: name,
    // @ts-expect-error
    createdBy: null,
    icon: { key: 'iconkey', version },
    status: db.RoomStatusEnum.CLOSE
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

  await db.collections.rooms.insertOne({
    _id: roomId,
    name,
    // @ts-expect-error
    createdBy: null,
    status: db.RoomStatusEnum.CLOSE
  })

  const putObjectMock = vi.mocked(storage.putObject)
  putObjectMock.mockResolvedValueOnce({} as never)

  const sizeOfMock = vi.mocked(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, {
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

  const room = await db.collections.rooms.findOne({ _id: roomId })

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

  const sizeOfMock = vi.mocked(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, {
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

  const sizeOfMock = vi.mocked(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, {
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
