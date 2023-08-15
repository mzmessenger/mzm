/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { IncomingHttpHeaders } from 'http'
import { vi, test, expect, beforeAll } from 'vitest'
vi.mock('undici', () => {
  return { request: vi.fn() }
})
vi.mock('../../lib/logger.js')
vi.mock('../../lib/storage.js')
vi.mock('../../lib/db.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/db.js')>(
    '../../lib/db.js'
  )
  return { ...actual, mongoClient: vi.fn() }
})

import { Readable } from 'stream'
import { ObjectId, WithId } from 'mongodb'
import { request } from 'undici'
import { BadRequest } from 'mzm-shared/lib/errors'
import { createRequest, getTestMongoClient } from '../../../test/testUtil.js'
import {
  createGetObjectMockValue,
  createHeadObjectMockValue
} from './testUtil.js'
import { collections, type User } from '../../lib/db.js'
import * as storage from '../../lib/storage.js'
import { getUserIcon } from './index.js'

beforeAll(async () => {
  const { mongoClient } = await import('../../lib/db.js')
  const { getTestMongoClient } = await import('../../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

type ResponseBody = Awaited<ReturnType<typeof request>>['body']

test('getUserIcon from storage', async () => {
  const userId = new ObjectId()
  const account = userId.toHexString()
  const version = '12345'

  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertOne({
    _id: userId,
    account,
    roomOrder: [],
    icon: { key: 'iconkey', version }
  })

  const req = createRequest(null, { params: { account, version } })

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
    const user: WithId<User> = {
      _id: id,
      account,
      roomOrder: []
    }
    if (iconVersion) {
      user.icon = { key: 'iconkey', version: iconVersion }
    }
    const db = await getTestMongoClient(globalThis)
    await collections(db).users.insertOne(user)

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
  const user: WithId<User> = {
    _id: id,
    account,
    roomOrder: [],
    icon: {
      key: 'iconkey',
      version: '1234'
    }
  }
  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertOne(user)

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
