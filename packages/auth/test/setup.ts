/* eslint-disable no-console */
import('./types.js')
import { once } from 'node:events'
import { afterAll, beforeAll } from 'vitest'
import { MongoClient } from 'mongodb'
import { Redis, type RedisOptions } from 'ioredis'
import { getTestDbName } from './testUtil.js'

const TEST_MONGODB_HOST = process.env.TEST_MONGODB_HOST ?? 'localhost'
const TEST_MONGODB_PORT = process.env.TEST_MONGODB_PORT ?? '27018'
const TEST_MONGO_ROOT_USER = process.env.TEST_MONGO_ROOT_USER ?? 'root'
const TEST_MONGO_ROOT_PASSWORD =
  process.env.TEST_MONGO_ROOT_PASSWORD ?? 'example'
const TEST_ROOT_MONGODB_URI = `mongodb://${TEST_MONGO_ROOT_USER}:${TEST_MONGO_ROOT_PASSWORD}@${TEST_MONGODB_HOST}:${TEST_MONGODB_PORT}`
const TEST_REDIS_HOST = process.env.TEST_REDIS_HOST ?? 'localhost'
const TEST_REDIS_PORT = process.env.TEST_REDIS_PORT
  ? Number(process.env.TEST_REDIS_PORT)
  : 6380

const VERBOSE = process.env.VERBOSE === 'true'

async function createMongoUser(
  client: MongoClient,
  dbname: string,
  user: string,
  password: string
) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('not test!!!!')
  }
  try {
    await client.db(dbname).removeUser(user)
  } catch (e) {
    if (VERBOSE) {
      console.log('remove user:', e)
    }
  }

  await client.db(dbname).command({
    createUser: user,
    pwd: password,
    roles: ['readWrite', 'dbAdmin']
  })
  if (VERBOSE) {
    console.log('createMongoUser:', dbname, user)
  }
}

beforeAll(async () => {
  const rootClient = await MongoClient.connect(TEST_ROOT_MONGODB_URI)

  const dbName = getTestDbName(process.env.VITEST_POOL_ID!)
  const testUserName = 'mzm-auth-test'
  const testUserPssword = 'mzm-auth-test-password'

  await createMongoUser(rootClient, dbName, testUserName, testUserPssword)

  await rootClient.close()

  const testMongoUri = `mongodb://${testUserName}:${testUserPssword}@${TEST_MONGODB_HOST}:${TEST_MONGODB_PORT}/${dbName}`
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
