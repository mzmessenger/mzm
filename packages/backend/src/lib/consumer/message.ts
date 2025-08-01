import { MongoClient } from 'mongodb'
import * as config from '../../config.js'
import { type ExRedisClient } from '../redis.js'
import { logger } from '../logger.js'
import { initConsumerGroup, createParser, consumeGroup } from './common.js'
import { sendToUser } from '../fetchStreaming.js'

type ReceiveQueue = {
  user?: string
  cmd: string
}

const STREAM = config.stream.MESSAGE
const GROUP = 'group:backend:message'

export async function initMessageConsumerGroup(client: ExRedisClient) {
  await initConsumerGroup(client, STREAM, GROUP)
}

export async function message({
  redis,
  ackId,
  messages
}: Parameters<Parameters<typeof createParser>[1]>[0]) {
  const message = messages[1]
  const queue = JSON.parse(message) as ReceiveQueue
  logger.info({
    label: 'consume:message',
    message: queue
  })
  if (queue.user) {
    sendToUser(queue.user, Buffer.from(message))
  }
  await redis.xack(STREAM, GROUP, ackId)
}

export async function consumeMessage({
  redis,
  db
}: {
  redis: ExRedisClient
  db: MongoClient
}) {
  const parser = createParser({ redis, db }, message)
  await consumeGroup(redis, GROUP, 'consume-backend', STREAM, parser)
}
