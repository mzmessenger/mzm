/* eslint-disable no-console */
import('./types.js')
import { once } from 'node:events'
import { afterAll, beforeAll } from 'vitest'
import { MongoClient } from 'mongodb'
import { Redis, type RedisOptions } from 'ioredis'
import { getTestDbName } from './testUtil.js'

const TEST_ROOT_MONGODB_URI =
  process.env.TEST_ROOT_MONGODB_URI ?? 'mongodb://root:example@localhost:27018'

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
    console.log(e)
  }

  await client.db(dbname).addUser(user, password, {
    roles: ['readWrite', 'dbAdmin']
  })
}

beforeAll(async () => {
  const rootClient = await MongoClient.connect(TEST_ROOT_MONGODB_URI)

  const dbName = getTestDbName(process.env.VITEST_POOL_ID!)
  const testUserName = 'mzm-backend-test'
  const testUserPssword = 'mzm-backend-test-password'

  await createMongoUser(rootClient, dbName, testUserName, testUserPssword)

  await rootClient.close()

  globalThis.testMongoClient = await MongoClient.connect(
    `mongodb://${testUserName}:${testUserPssword}@localhost:27018/${dbName}`
  )
})

beforeAll(async () => {
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
  globalThis.testRedisClient = redisClient
})

afterAll(async () => {
  await globalThis.testMongoClient.db().dropDatabase()
  await Promise.all([
    globalThis.testMongoClient.close(),
    globalThis.testRedisClient.disconnect()
  ])
})
