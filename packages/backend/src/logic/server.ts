import { MongoClient } from 'mongodb'
import { type ExRedisClient } from '../lib/redis.js'
import { addInitializeSearchRoomQueue } from '../lib/provider/index.js'
import { initGeneral } from './rooms.js'
import { initConsumer } from '../lib/consumer/index.js'

export async function init({
  db,
  redis
}: {
  db: MongoClient
  redis: ExRedisClient
}) {
  await Promise.all([initGeneral({ db, redis }), initConsumer({ db, redis })])

  addInitializeSearchRoomQueue(redis)
}
