import { vi, test, expect, beforeEach } from 'vitest'
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
import { collections } from '../../lib/db'
import * as storage from '../../lib/storage'
import * as config from '../../config'
import { BadRequest } from 'mzm-shared/lib/errors'
import { uploadUserIcon } from './index'

beforeEach(() => {
  vi.resetAllMocks()
})

test('uploadUserIcon', async () => {
  const userId = new ObjectId()

  const db = await getTestMongoClient()
  await collections(db).users.insertOne({
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

  const res = await uploadUserIcon(req)

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
      await uploadUserIcon(req)
    } catch (e) {
      expect(e instanceof BadRequest).toStrictEqual(true)
    }
  }
)

test('uploadUserIcon: empty file', async () => {
  expect.assertions(1)

  const name = new ObjectId().toHexString()

  const req = createFileRequest(new ObjectId(), {
    file: undefined,
    params: { roomname: name }
  })

  try {
    await uploadUserIcon(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

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
    await uploadUserIcon(req)
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
    await uploadUserIcon(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
