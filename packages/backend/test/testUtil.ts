/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-console */
import type { MulterFile } from '../src/types/index.js'
import type { MongoClient, ObjectId } from 'mongodb'
import('./types.js')
import { vi } from 'vitest'
import { Request } from 'express'
import { client as RedisClient } from '../src/lib/redis.js'

export const createXaddMock = (client: typeof RedisClient) => {
  const xadd = vi.fn()
  // @ts-expect-error
  vi.mocked(client).mockImplementation(() => ({ xadd }))
  return xadd
}

export const createXackMock = (client: typeof RedisClient) => {
  const xack = vi.fn()
  // @ts-expect-error
  vi.mocked(client).mockImplementation(() => ({ xack }))

  return xack
}

export const getTestDbName = (suffix: string) => {
  return `mzm-test-${suffix}`
}

export const getTestMongoClient = async (context: typeof globalThis) => {
  return context.testMongoClient as MongoClient
}

export const getTestRedisClient = async (context: typeof globalThis) => {
  return context.testRedisClient
}

export const dropCollection = async (client: MongoClient, name: string) => {
  const collections = (await client.db().collections()).map(
    (c) => c.collectionName
  )
  if (!collections.includes(name)) {
    return Promise.resolve()
  }
  await client.db().collection(name).drop()
}

type TestRequest = Request & { file?: MulterFile }

export const createFileRequest = (
  ...args: Parameters<typeof createRequest>
) => {
  return createRequest(...args) as Request & { file?: MulterFile }
}

export const createRequest = <T>(
  userId: ObjectId | null,
  {
    params,
    query,
    body,
    file
  }: {
    params?: { [key: string]: string }
    query?: { [key: string]: string }
    body?: Partial<T>
    file?: { [key: string]: string | number }
  }
): TestRequest => {
  const req = {
    headers: {
      'x-user-id': userId?.toHexString()
    },
    query: {},
    params: {},
    body: {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any

  if (params) {
    req.params = params
  }

  if (query) {
    req.query = query
  }

  if (body) {
    req.body = body
  }

  if (file) {
    req.file = file
  }

  return req as TestRequest
}
