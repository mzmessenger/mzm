jest.mock('undici', () => {
  return { request: jest.fn() }
})
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
import { uploadRoomIcon } from './index'

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

test('uploadRoomIcon', async () => {
  const roomId = new ObjectId()
  const name = roomId.toHexString()

  await db.collections.rooms.insertOne({
    _id: roomId,
    name,
    createdBy: null,
    status: db.RoomStatusEnum.CLOSE
  })

  const putObjectMock = jest.mocked(storage.putObject)
  putObjectMock.mockResolvedValueOnce({} as any)

  const sizeOfMock = jest.mocked(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, {
      width: config.icon.MAX_USER_ICON_SIZE,
      height: config.icon.MAX_USER_ICON_SIZE
    })
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

  const req = createRequest(new ObjectId(), {
    file,
    params: { roomname: name }
  })

  const res = await uploadRoomIcon(req as any)

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
      await uploadRoomIcon(req as any)
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

  const sizeOfMock = jest.mocked(sizeOf)
  sizeOfMock.mockImplementation((path, cb) => {
    cb(null, {
      width: config.icon.MAX_ROOM_ICON_SIZE + 1,
      height: config.icon.MAX_ROOM_ICON_SIZE + 1
    })
  })

  const req = createRequest(new ObjectId(), { file })

  try {
    await uploadRoomIcon(req as any)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
