/* eslint-disable no-empty-pattern */
import type { IncomingHttpHeaders } from 'http'
import { vi, test as baseTest, expect } from 'vitest'
vi.mock('undici', () => {
  return { request: vi.fn() }
})
vi.mock('../../lib/logger.js')
vi.mock('../../lib/storage.js')
vi.mock('../../lib/db.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/db.js')>('../../lib/db.js')
  return { ...actual, mongoClient: vi.fn() }
})

import { Readable } from 'stream'
import { ObjectId, WithId } from 'mongodb'
import { request } from 'undici'
import { BadRequest } from 'mzm-shared/src/lib/errors'
import { getTestMongoClient } from '../../../test/testUtil.js'
import {
  createGetObjectMockValue,
  createHeadObjectMockValue
} from './testUtil.js'
import { collections, type User } from '../../lib/db.js'
import * as storage from '../../lib/storage.js'
import { getUserIcon } from './index.js'

type ResponseBody = Awaited<ReturnType<typeof request>>['body']

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

test('getUserIcon from storage', async ({ testDb }) => {
  const userId = new ObjectId()
  const account = userId.toHexString()
  const version = '12345'

  await collections(testDb).users.insertOne({
    _id: userId,
    account,
    roomOrder: [],
    icon: { key: 'iconkey', version }
  })


  const headObjectMock = vi.mocked(storage.headObject).mockClear()
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
    Body: readableStream
  })
  getObjectMock.mockReturnValueOnce(getObject)

  const res = await getUserIcon(testDb, {account, version })

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

test.for([
  [undefined, '1234'], // no version
  ['1234', '4321'] // different version
])(
  'getUserIcon from identicon (user: %s, icon version: %s, request icon version: %s)',
  async ([iconVersion, requestVersion], { testDb }) => {
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
    await collections(testDb).users.insertOne(user)

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
      trailers: {},
      opaque: undefined,
      context: {}
    })

    const res = await getUserIcon(testDb, { account, version: requestVersion })

    expect(headObjectMock.mock.calls.length).toStrictEqual(0)
    expect(getObjectMock.mock.calls.length).toStrictEqual(0)
    expect(requestMock.mock.calls.length).toStrictEqual(1)
    for (const [key, val] of Object.entries(headers)) {
      expect(res.headers[key]).toStrictEqual(val)
    }
    expect(res.stream).toStrictEqual(readableStream)
  }
)

test('getUserIcon from identicon: not found on storage', async ({ testDb }) => {
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
  await collections(testDb).users.insertOne(user)

  const headObjectMock = vi.mocked(storage.headObject).mockClear()
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
    trailers: {},
    opaque: undefined,
    context: {}
  })

  const res = await getUserIcon(testDb, { account, version: user?.icon?.version ?? '' })

  expect(headObjectMock.mock.calls.length).toStrictEqual(1)
  expect(res.headers.ETag).toStrictEqual(headers.ETag)
  expect(res.headers['Content-Type']).toStrictEqual(headers['Content-Type'])
  expect(res.headers['Content-Length']).toStrictEqual(headers['Content-Length'])
  expect(res.headers['last-modified']).toStrictEqual(headers['last-modified'])
  expect(res.headers['Cache-Control']).toStrictEqual(headers['Cache-Control'])
  expect(res.stream).toStrictEqual(readableStream)
})

test('getUserIcon BadRequest: no account', async ({ testDb }) => {
  expect.assertions(1)

  try {
    await getUserIcon(testDb, { account: '', version: '12345' })
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
