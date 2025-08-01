import type { MongoClient } from 'mongodb'
import type { ExRedisClient } from '../src/lib/redis.js'

declare global {
  var testMongoClient: MongoClient
  var testRedisClient: ExRedisClient
}
