jest.mock('axios')
jest.mock('image-size')
jest.mock('../lib/logger')
jest.mock('../lib/storage')

import { Readable } from 'stream'
import { ObjectId, WithId } from 'mongodb'
import axios from 'axios'
import sizeOf from 'image-size'
import { mongoSetup, createRequest, getMockType } from '../../jest/testUtil'
import type { MongoMemoryServer } from 'mongodb-memory-server'
import * as db from '../lib/db'
import * as storage from '../lib/storage'
import * as config from '../config'
import { BadRequest, NotFound } from '../lib/errors'
import * as icon from './icon'

let mongoServer: MongoMemoryServer = null

beforeAll(async () => {
  const mongo = await mongoSetup()
  mongoServer = mongo.mongoServer
  return await db.connect(mongo.uri)
})

beforeEach(() => {
  jest.resetAllMocks()
})

afterAll(async () => {
  await db.close()
  await mongoServer.stop()
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

  const headObjectMock = getMockType(storage.headObject)
  const headers = {
    ETag: 'etag',
    ContentType: 'image/png',
    ContentLength: 12345,
    LastModified: new Date(2020, 0, 1),
    CacheControl: 'max-age=604800'
  } as const
  headObjectMock.mockResolvedValueOnce(headers)
  const getObjectMock = getMockType(storage.getObject)
  const readableStream = new Readable()
  getObjectMock.mockReturnValueOnce({
    createReadStream: () => readableStream
  })

  const res = await icon.getUserIcon(req)

  expect(headObjectMock.mock.calls.length).toStrictEqual(1)
  expect(getObjectMock.mock.calls.length).toStrictEqual(1)
  expect(res.headers.ETag).toStrictEqual(headers.ETag)
  expect(res.headers['Content-Type']).toStrictEqual(headers.ContentType)
  expect(res.headers['Content-Length']).toStrictEqual(headers.ContentLength)
  expect((res.headers['Last-Modified'] as Date).getTime()).toStrictEqual(
    headers.LastModified.getTime()
  )
  expect(res.headers['Cache-Control']).toStrictEqual(headers.CacheControl)
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

    const headObjectMock = getMockType(storage.headObject)
    const getObjectMock = getMockType(storage.getObject)
    const axiosMock = getMockType(axios)
    const headers = {
      ETag: 'etag',
      'Content-Type': 'image/png',
      'Content-Length': 12345,
      'Last-Modified': new Date(2020, 0, 1),
      'Cache-Control': 'max-age=604800'
    } as const
    const readableStream = new Readable()
    axiosMock.mockResolvedValueOnce({ headers, data: readableStream })

    const req = createRequest(null, {
      params: { account, version: requestVersion }
    })

    const res = await icon.getUserIcon(req)

    expect(headObjectMock.mock.calls.length).toStrictEqual(0)
    expect(getObjectMock.mock.calls.length).toStrictEqual(0)
    expect(axiosMock.mock.calls.length).toStrictEqual(1)
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

  const headObjectMock = getMockType(storage.headObject)
  headObjectMock.mockRejectedValueOnce({ statusCode: 404 })
  const axiosMock = getMockType(axios)
  const headers = {
    ETag: 'etag',
    'Content-Type': 'image/png',
    'Content-Length': 12345,
    'Last-Modified': new Date(2020, 0, 1),
    'Cache-Control': 'max-age=604800'
  } as const
  const readableStream = new Readable()
  axiosMock.mockResolvedValueOnce({ headers, data: readableStream })

  const req = createRequest(null, {
    params: { account, version: user.icon.version }
  })

  const res = await icon.getUserIcon(req)

  expect(headObjectMock.mock.calls.length).toStrictEqual(1)
  expect(res.headers.ETag).toStrictEqual(headers.ETag)
  expect(res.headers['Content-Type']).toStrictEqual(headers['Content-Type'])
  expect(res.headers['Content-Length']).toStrictEqual(headers['Content-Length'])
  expect((res.headers['Last-Modified'] as Date).getTime()).toStrictEqual(
    headers['Last-Modified'].getTime()
  )
  expect(res.headers['Cache-Control']).toStrictEqual(headers['Cache-Control'])
  expect(res.stream).toStrictEqual(readableStream)
})

test('getUserIcon BadRequest: no account', async () => {
  expect.assertions(1)

  const version = '12345'

  const req = createRequest(null, { params: { account: null, version } })

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

  const putObjectMock = getMockType(storage.putObject)
  putObjectMock.mockResolvedValueOnce({})

  const sizeOfMock = getMockType(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, { width: 100, height: 100 })
  })
  const createBodyFromFilePath = getMockType(storage.createBodyFromFilePath)
  const readableStream = new Readable()
  createBodyFromFilePath.mockReturnValue(readableStream)

  const file = {
    key: 'filekey',
    mimetype: 'image/png',
    originalname: 'fileoriginalname.png',
    size: 1,
    filename: 'filename.png',
    path: '/path/to/file'
  }

  const req = createRequest(userId, { file })

  const res = await icon.uploadUserIcon(req as any)

  const user = await db.collections.users.findOne({ _id: userId })

  expect(typeof user.icon.version).toStrictEqual('string')
  expect(res.version).toStrictEqual(user.icon.version)
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

    const req = createRequest(userId, { file })

    try {
      await icon.uploadUserIcon(req as any)
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

  const sizeOfMock = getMockType(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, {
      width: config.icon.MAX_USER_ICON_SIZE + 1,
      height: config.icon.MAX_USER_ICON_SIZE + 1
    })
  })

  const req = createRequest(userId, { file })

  try {
    await icon.uploadUserIcon(req as any)
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

  const sizeOfMock = getMockType(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, {
      width: config.icon.MAX_USER_ICON_SIZE - 1,
      height: config.icon.MAX_USER_ICON_SIZE - 2
    })
  })

  const req = createRequest(userId, { file })

  try {
    await icon.uploadUserIcon(req as any)
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
    createdBy: null,
    updatedBy: null,
    icon: { key: 'iconkey', version },
    status: db.RoomStatusEnum.CLOSE
  })

  const req = createRequest(null, { params: { roomname: name, version } })

  const headObjectMock = getMockType(storage.headObject)
  const headers = {
    ETag: 'etag',
    ContentType: 'image/png',
    ContentLength: 12345,
    LastModified: new Date(2020, 0, 1),
    CacheControl: 'max-age=604800'
  } as const
  headObjectMock.mockResolvedValueOnce(headers)
  const getObjectMock = getMockType(storage.getObject)
  const readableStream = new Readable()
  getObjectMock.mockReturnValueOnce({
    createReadStream: () => readableStream
  })

  const res = await icon.getRoomIcon(req)

  expect(headObjectMock.mock.calls.length).toStrictEqual(1)
  expect(getObjectMock.mock.calls.length).toStrictEqual(1)
  expect(res.headers.ETag).toStrictEqual(headers.ETag)
  expect(res.headers['Content-Type']).toStrictEqual(headers.ContentType)
  expect(res.headers['Content-Length']).toStrictEqual(headers.ContentLength)
  expect((res.headers['Last-Modified'] as Date).getTime()).toStrictEqual(
    headers.LastModified.getTime()
  )
  expect(res.headers['Cache-Control']).toStrictEqual(headers.CacheControl)
  expect(res.stream).toStrictEqual(readableStream)
})

test('getRoomIcon BadRequest: no room name', async () => {
  expect.assertions(1)

  const version = '12345'

  const req = createRequest(null, { params: { roomname: null, version } })

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
    createdBy: null,
    icon: { key: 'iconkey', version },
    status: db.RoomStatusEnum.CLOSE
  })

  const headObjectMock = getMockType(storage.headObject)
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
    createdBy: null,
    status: db.RoomStatusEnum.CLOSE
  })

  const putObjectMock = getMockType(storage.putObject)
  putObjectMock.mockResolvedValueOnce({})

  const sizeOfMock = getMockType(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, {
      width: config.icon.MAX_USER_ICON_SIZE,
      height: config.icon.MAX_USER_ICON_SIZE
    })
  })
  const createBodyFromFilePath = getMockType(storage.createBodyFromFilePath)
  const readableStream = new Readable()
  createBodyFromFilePath.mockReturnValue(readableStream)

  const file = {
    key: 'filekey',
    mimetype: 'image/png',
    originalname: 'fileoriginalname.png',
    size: 1,
    filename: 'filename.png',
    path: '/path/to/file'
  }

  const req = createRequest(new ObjectId(), {
    file,
    params: { roomname: name }
  })

  const res = await icon.uploadRoomIcon(req as any)

  const room = await db.collections.rooms.findOne({ _id: roomId })

  expect(typeof room.icon.version).toStrictEqual('string')
  expect(res.version).toStrictEqual(room.icon.version)
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

    const req = createRequest(new ObjectId(), {
      file,
      params: { roomname: name }
    })

    try {
      await icon.uploadRoomIcon(req as any)
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

  const sizeOfMock = getMockType(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, {
      width: config.icon.MAX_ROOM_ICON_SIZE + 1,
      height: config.icon.MAX_ROOM_ICON_SIZE + 1
    })
  })

  const req = createRequest(new ObjectId(), { file })

  try {
    await icon.uploadRoomIcon(req as any)
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

  const sizeOfMock = getMockType(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, {
      width: config.icon.MAX_ROOM_ICON_SIZE - 1,
      height: config.icon.MAX_ROOM_ICON_SIZE - 2
    })
  })

  const req = createRequest(userId, { file })

  try {
    await icon.uploadUserIcon(req as any)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
