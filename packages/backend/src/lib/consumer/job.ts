import { type MongoClient } from 'mongodb'
import * as config from '../../config.js'
import { JobType } from '../../types.js'
import { logger } from '../logger.js'
import { client } from '../redis.js'
import { initConsumerGroup, createParser, consumeGroup } from './common.js'
import { syncSeachAllRooms } from '../../logic/rooms.js'

const STREAM = config.stream.JOB
const JOB_GROUP = 'group:job'

export async function initJobConsumerGroup() {
  await initConsumerGroup(STREAM, JOB_GROUP)
}

export async function job(db: MongoClient, ackid: string, messages: string[]) {
  if (messages[0] === JobType.SEARCH_ROOM) {
    await syncSeachAllRooms(db)
  }

  await client().xack(STREAM, JOB_GROUP, ackid)

  logger.info('[job]', messages[0])
}

export async function consumeJob(db: MongoClient) {
  const parser = createParser(db, job)
  await consumeGroup(JOB_GROUP, 'consume-backend', STREAM, parser)
}
