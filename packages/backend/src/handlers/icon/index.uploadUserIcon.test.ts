jest.mock('image-size')
jest.mock('../../lib/logger')
jest.mock('../../lib/storage')

import { Readable } from 'stream'
import type { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import sizeOf from 'image-size'
import { mongoSetup, createRequest } from '../../../jest/testUtil'
import * as db from '../../lib/db'
import * as storage from '../../lib/storage'
import * as config from '../../config'
import { BadRequest } from '../../lib/errors'
import { uploadUserIcon } from './index'

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

test('uploadUserIcon', async () => {
  const userId = new ObjectId()

  await db.collections.users.insertOne({
    _id: userId,
    account: userId.toString(),
    roomOrder: []
  })

  const putObjectMock = jest.mocked(storage.putObject)
  putObjectMock.mockResolvedValueOnce({} as any)

  const sizeOfMock = jest.mocked(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, { width: 100, height: 100 })
  })
  const createBodyFromFilePath = jest.mocked(storage.createBodyFromFilePath)
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

  const req = createRequest(userId, { file })

  const res = await uploadUserIcon(req as any)

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
      await uploadUserIcon(req as any)
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

  const sizeOfMock = jest.mocked(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, {
      width: config.icon.MAX_USER_ICON_SIZE + 1,
      height: config.icon.MAX_USER_ICON_SIZE + 1
    })
  })

  const req = createRequest(userId, { file })

  try {
    await uploadUserIcon(req as any)
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

  const sizeOfMock = jest.mocked(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, {
      width: config.icon.MAX_USER_ICON_SIZE - 1,
      height: config.icon.MAX_USER_ICON_SIZE - 2
    })
  })

  const req = createRequest(userId, { file })

  try {
    await uploadUserIcon(req as any)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
