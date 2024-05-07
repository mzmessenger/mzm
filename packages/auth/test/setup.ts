/* eslint-disable no-console */
import('./types.js')
import { once } from 'node:events'
import { afterAll, beforeAll } from 'vitest'
import { MongoClient } from 'mongodb'
import { Redis, type RedisOptions } from 'ioredis'
import { getTestDbName, getTestDbParams } from './testUtil.js'

const TEST_REDIS_HOST = process.env.TEST_REDIS_HOST ?? 'localhost'
const TEST_REDIS_PORT = process.env.TEST_REDIS_PORT
  ? Number(process.env.TEST_REDIS_PORT)
  : 6380

beforeAll(async () => {
  const dbName = getTestDbName(process.env.VITEST_POOL_ID!)
  const { userName, userPassword, host, port } = getTestDbParams()

  const testMongoUri = `mongodb://${userName}:${userPassword}@${host}:${port}/${dbName}`
  globalThis.testMongoClient = await MongoClient.connect(testMongoUri)
})

beforeAll(async () => {
  const testSessionRedisOptions: RedisOptions = {
    host: TEST_REDIS_HOST,
    port: TEST_REDIS_PORT,
    enableOfflineQueue: false,
    connectTimeout: 30000,
    db: 1
  }
  const redisClient = new Redis(testSessionRedisOptions)
  redisClient.on('error', (e) => {
    console.error(e)
  })

  await once(redisClient, 'ready')
  globalThis.testSessionRedisClient = redisClient
})

afterAll(async () => {
  await globalThis.testMongoClient?.db().dropDatabase()
  await Promise.all([
    globalThis.testMongoClient?.close(),
    globalThis.testSessionRedisClient?.disconnect()
  ])
})
