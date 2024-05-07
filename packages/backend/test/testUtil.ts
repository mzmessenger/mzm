/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { MulterFile } from '../src/types/index.js'
import type { MongoClient, ObjectId } from 'mongodb'
import type { Request } from 'express'

import('./types.js')

export function getTestDbName(suffix: string) {
  return `mzm-auth-${suffix}`
}

export function getTestDbParams() {
  const TEST_MONGODB_HOST = process.env.TEST_MONGODB_HOST ?? 'localhost'
  const TEST_MONGODB_PORT = process.env.TEST_MONGODB_PORT ?? '27018'

  const userName = 'mzm-auth-test'
  const userPassword = 'mzm-auth-test-password'

  return {
    userName,
    userPassword,
    host: TEST_MONGODB_HOST,
    port: TEST_MONGODB_PORT
  }
}

export async function getTestMongoClient(context: typeof globalThis) {
  return context.testMongoClient
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

export const createFileRequest = <TBody, TParams = { [key: string]: string }>(
  ...args: Parameters<typeof createRequest<TBody, TParams>>
) => {
  return createRequest<TBody, TParams>(...args) as Request & {
    file?: MulterFile
  }
}

export const createRequest = <TBody, TParams = { [key: string]: string }>(
  userId: ObjectId | null,
  {
    params,
    query,
    body,
    file
  }: {
    params?: TParams
    query?: { [key: string]: string }
    body?: TBody
    file?: { [key: string]: string | number }
  }
) => {
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

  return req as Request
}
