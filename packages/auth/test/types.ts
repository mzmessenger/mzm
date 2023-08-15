import type { MongoClient } from 'mongodb'
import { Redis } from 'ioredis'

declare global {
  /* eslint-disable no-var */
  var testMongoClient: MongoClient
  var testSessionRedisClient: Redis
  /* eslint-enable no-var */
}
