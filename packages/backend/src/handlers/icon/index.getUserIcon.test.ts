import type { IncomingHttpHeaders } from 'http'
import type { MongoMemoryServer } from 'mongodb-memory-server'
import { vi, test, expect, beforeAll, beforeEach, afterAll } from 'vitest'
vi.mock('undici', () => {
  return { request: vi.fn() }
})
vi.mock('../../lib/logger')
vi.mock('../../lib/storage')

import { Readable } from 'stream'
import { ObjectId, WithId } from 'mongodb'
import { request } from 'undici'
import { mongoSetup, createRequest } from '../../../test/testUtil'
import { createGetObjectMockValue, createHeadObjectMockValue } from './testUtil'
import * as db from '../../lib/db'
import * as storage from '../../lib/storage'
import { BadRequest } from '../../lib/errors'
import { getUserIcon } from './index'

type ResponseBody = Awaited<ReturnType<typeof request>>['body']

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

  const res = await getUserIcon(req)

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

    const res = await getUserIcon(req)

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
    params: { account, version: user?.icon?.version ?? '' }
  })

  const res = await getUserIcon(req)

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
    await getUserIcon(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
