/* eslint-disable no-console */
import type { RedisOptions } from 'ioredis'
import { once } from 'node:events'
import { MongoClient } from 'mongodb'
import { Redis } from 'ioredis'

const TEST_MONGODB_URI =
  process.env.TEST_MONTO_URI ??
  'mongodb://mzm-auth-test:mzm-auth-test-password@localhost:27018/auth'

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

const sessionRedis = new Redis(testSessionRedisOptions)
sessionRedis.on('error', (e) => {
  console.error(e)
})
await Promise.all([once(sessionRedis, 'ready')])

export const getTestRedisClient = async () => {
  return { sessionRedis }
}

export const generateCodeVerifier = () => {
  const mask =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_~.'

  const randomValues = crypto.getRandomValues(new Uint8Array(43))

  let random = ''
  for (const value of randomValues) {
    random += mask[value % mask.length]
  }

  return random
}
