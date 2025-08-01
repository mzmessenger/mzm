/* eslint-disable no-empty-pattern */
import { vi, test as baseTest, expect } from 'vitest'
vi.mock('../../lib/image.js')
vi.mock('../../lib/logger.js')
vi.mock('../../lib/storage.js')
vi.mock('../../lib/db.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/db.js')>('../../lib/db.js')
  return { ...actual, mongoClient: vi.fn() }
})

import { Readable } from 'stream'
import { ObjectId } from 'mongodb'
import { BadRequest } from 'mzm-shared/src/lib/errors'
import {
  getTestMongoClient
} from '../../../test/testUtil.js'
import { collections } from '../../lib/db.js'
import * as storage from '../../lib/storage.js'
import * as config from '../../config.js'
import { uploadUserIcon } from './index.js'
import { sizeOf } from '../../lib/image.js'

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

test('uploadUserIcon', async ({ testDb }) => {
  const userId = new ObjectId()

  await collections(testDb).users.insertOne({
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

  const res = await uploadUserIcon(testDb, { userId, file })

  const user = await collections(testDb).users.findOne({ _id: userId })

  expect(typeof user?.icon?.version).toStrictEqual('string')
  expect(res.version).toStrictEqual(user?.icon?.version)
})

test.for([['image/gif'], ['image/svg+xml']])(
  'uploadUserIcon: fail file type (%s)',
  async ([mimetype], { testDb }) => {
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

    try {
      await uploadUserIcon(testDb, { userId, file })
    } catch (e) {
      expect(e instanceof BadRequest).toStrictEqual(true)
    }
  }
)

test('uploadUserIcon: empty file', async ({ testDb }) => {
  expect.assertions(1)

  try {
    await uploadUserIcon(testDb, { userId: new ObjectId(), file: undefined })
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('uploadUserIcon validation: size over', async ({ testDb }) => {
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

  try {
    await uploadUserIcon(testDb, { userId, file })
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('uploadUserIcon validation: not square', async ({ testDb }) => {
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

  try {
    await uploadUserIcon(testDb, { userId, file })
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
