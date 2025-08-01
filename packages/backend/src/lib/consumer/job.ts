import { type MongoClient } from 'mongodb'
import * as config from '../../config.js'
import { JobType } from '../../types.js'
import { logger } from '../logger.js'
import { type ExRedisClient } from '../redis.js'
import { initConsumerGroup, createParser, consumeGroup } from './common.js'
import { syncSeachAllRooms } from '../../logic/rooms.js'

const STREAM = config.stream.JOB
const JOB_GROUP = 'group:job'

export async function initJobConsumerGroup(client: ExRedisClient) {
  await initConsumerGroup(client, STREAM, JOB_GROUP)
}

export async function job({
  redis,
  db,
  ackId,
  messages
}: Parameters<Parameters<typeof createParser>[1]>[0]) {
  if (messages[0] === JobType.SEARCH_ROOM) {
    await syncSeachAllRooms({ db, redis })
  }

  await redis.xack(STREAM, JOB_GROUP, ackId)

  logger.info('[job]', messages[0])
}

export async function consumeJob({
  redis,
  db
}: {
  redis: ExRedisClient
  db: MongoClient
}) {
  const parser = createParser({ redis, db }, job)
  await consumeGroup(redis, JOB_GROUP, 'consume-backend', STREAM, parser)
}
