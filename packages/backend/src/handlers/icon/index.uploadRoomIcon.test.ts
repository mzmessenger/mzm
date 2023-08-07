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
import sizeOf from 'image-size'
import { createFileRequest, getTestMongoClient } from '../../../test/testUtil'
import { collections, RoomStatusEnum } from '../../lib/db'
import * as storage from '../../lib/storage'
import * as config from '../../config'
import { BadRequest } from 'mzm-shared/lib/errors'
import { uploadRoomIcon } from './index'

beforeEach(() => {
  vi.resetAllMocks()
})

test('uploadRoomIcon', async () => {
  const roomId = new ObjectId()
  const name = roomId.toHexString()

  const db = await getTestMongoClient()
  await collections(db).rooms.insertOne({
    _id: roomId,
    name,
    createdBy: new ObjectId().toHexString(),
    status: RoomStatusEnum.CLOSE
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

  const res = await uploadRoomIcon(req)

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
      await uploadRoomIcon(req)
    } catch (e) {
      expect(e instanceof BadRequest).toStrictEqual(true)
    }
  }
)

test('uploadRoomIcon: empty file', async () => {
  expect.assertions(1)

  const name = new ObjectId().toHexString()

  const req = createFileRequest(new ObjectId(), {
    file: undefined,
    params: { roomname: name }
  })

  try {
    await uploadRoomIcon(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

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
    await uploadRoomIcon(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
