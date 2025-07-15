import type { MongoClient } from 'mongodb'
import { Redis } from 'ioredis'

declare global {
  var testMongoClient: MongoClient
  var testRedisClient: Redis
}
