import assert from 'assert'
import { Request } from 'express'
import { MongoClient, ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { client as Redis } from '../src/lib/redis'
import IORedis from 'ioredis'

export const createXaddMock = (xadd: typeof Redis.xadd) => {
  const mock =
    jest.mocked<
      (key: IORedis.KeyType, ...args: IORedis.ValueType[]) => Promise<string>
    >(xadd)
  return mock
}

export const createXackMock = (xack: typeof Redis.xack) => {
  const mock =
    jest.mocked<
      (key: IORedis.KeyType, ...args: IORedis.ValueType[]) => Promise<number>
    >(xack)

  return mock
}

export const mongoSetup = async () => {
  const mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()
  return { uri, mongoServer }
}

export const getDbConnection = async (uri: string) => {
  assert.strictEqual(process.env.NODE_ENV, 'test')

  const client = await MongoClient.connect(uri)

  return client
}

export const dropCollection = async (uri: string, name: string) => {
  const client = await getDbConnection(uri)
  const db = client.db('mzm')

  const collections = (await db.collections()).map((c) => c.collectionName)
  if (!collections.includes(name)) {
    return Promise.resolve()
  }
  return await db.collection(name).drop()
}

type TestRequest = Request & { file?: { [key: string]: string | number } }

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
