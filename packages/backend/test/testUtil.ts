/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable no-console */
import type { MulterFile } from '../src/types/index.js'
import { once } from 'node:events'
import { Redis, type RedisOptions } from 'ioredis'
import { vi } from 'vitest'
import { Request } from 'express'
import { MongoClient, ObjectId } from 'mongodb'
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

const TEST_MONGODB_URI =
  process.env.TEST_MONTO_URI ??
  'mongodb://mzm-backend-test:mzm-backend-test-password@localhost:27018/mzm-test'

let mongoClient: MongoClient | null = null

export const getTestMongoClient = async () => {
  if (!mongoClient) {
    mongoClient = await MongoClient.connect(TEST_MONGODB_URI)
  }

  return mongoClient
}

const testSessionRedisOptions: RedisOptions = {
  host: process.env.TEST_SESSION_REDIS_HOST ?? 'localhost',
  port: process.env.TEST_SESSION_REDIS_PORT
    ? Number(process.env.TEST_SESSION_REDIS_PORT)
    : 6380,
  enableOfflineQueue: false,
  connectTimeout: 30000,
  db: 1
}

const redisClient = new Redis(testSessionRedisOptions)
redisClient.on('error', (e) => {
  console.error(e)
})
await Promise.all([once(redisClient, 'ready')])

export const getTestRedisClient = async () => {
  return { client: RedisClient }
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
