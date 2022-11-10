import * as config from '../../config.js'
import { JobType } from '../../types.js'
import { logger } from '../logger.js'
import { client } from '../redis.js'
import { initConsumerGroup, createParser, consumeGroup } from './common.js'
import { syncSeachAllRooms } from '../../logic/rooms.js'

const STREAM = config.stream.JOB
const JOB_GROUP = 'group:job'

export const initJobConsumerGroup = async () => {
  await initConsumerGroup(STREAM, JOB_GROUP)
}

export const job = async (ackid: string, messages: string[]) => {
  if (messages[0] === JobType.SEARCH_ROOM) {
    await syncSeachAllRooms()
  }

  await client.xack(STREAM, JOB_GROUP, ackid)

  logger.info('[job]', messages[0])
}

export const consumeJob = async () => {
  const parser = createParser(job)
  await consumeGroup(JOB_GROUP, 'consume-backend', STREAM, parser)
}
