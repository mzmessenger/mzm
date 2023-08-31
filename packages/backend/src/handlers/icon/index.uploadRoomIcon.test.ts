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

import type { API } from 'mzm-shared/type/api'
import { Readable } from 'stream'
import { ObjectId } from 'mongodb'
import { BadRequest } from 'mzm-shared/lib/errors'
import {
  createFileRequest,
  getTestMongoClient
} from '../../../test/testUtil.js'
import { collections, RoomStatusEnum } from '../../lib/db.js'
import * as storage from '../../lib/storage.js'
import * as config from '../../config.js'
import { uploadRoomIcon } from './index.js'
import { sizeOf } from '../../lib/image.js'

type ParamsType = API['/api/icon/rooms/:roomname']['params']

beforeAll(async () => {
  const { mongoClient } = await import('../../lib/db.js')
  const { getTestMongoClient } = await import('../../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

test('uploadRoomIcon', async () => {
  const roomId = new ObjectId()
  const name = roomId.toHexString()

  const db = await getTestMongoClient(globalThis)
  await collections(db).rooms.insertOne({
    _id: roomId,
    name,
    createdBy: new ObjectId().toHexString(),
    status: RoomStatusEnum.CLOSE
  })

  vi.mocked(storage.putObject).mockResolvedValueOnce({} as never)

  vi.mocked(sizeOf).mockImplementationOnce(() => {
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

  const req = createFileRequest<unknown, ParamsType>(new ObjectId(), {
    file,
    params: { roomname: name }
  })

  const res = await uploadRoomIcon.handler(req)

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

    const req = createFileRequest<unknown, ParamsType>(new ObjectId(), {
      file,
      params: { roomname: name }
    })

    try {
      await uploadRoomIcon.handler(req)
    } catch (e) {
      expect(e instanceof BadRequest).toStrictEqual(true)
    }
  }
)

test('uploadRoomIcon: empty file', async () => {
  expect.assertions(1)

  const name = new ObjectId().toHexString()

  const req = createFileRequest<unknown, ParamsType>(new ObjectId(), {
    file: undefined,
    params: { roomname: name }
  })

  try {
    await uploadRoomIcon.handler(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('uploadRoomIcon: validation: size over ', async () => {
  expect.assertions(1)

  const name = new ObjectId().toHexString()

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

  const req = createFileRequest<unknown, ParamsType>(new ObjectId(), {
    file,
    params: { roomname: name }
  })

  try {
    await uploadRoomIcon.handler(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('uploadUserIcon validation: not square', async () => {
  expect.assertions(1)

  const userId = new ObjectId()
  const name = new ObjectId().toHexString()

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

  const req = createFileRequest<unknown, ParamsType>(userId, {
    file,
    params: { roomname: name }
  })

  try {
    await uploadRoomIcon.handler(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
