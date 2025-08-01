import { MongoClient } from 'mongodb'
import * as config from '../../config.js'
import { client } from '../redis.js'
import { logger } from '../logger.js'
import { initConsumerGroup, createParser, consumeGroup } from './common.js'
import { sendToUser } from '../fetchStreaming.js'

type ReceiveQueue = {
  user?: string
  cmd: string
}

const STREAM = config.stream.MESSAGE
const GROUP = 'group:backend:message'

export async function initMessageConsumerGroup() {
  await initConsumerGroup(STREAM, GROUP)
}

export async function message(db: MongoClient, ackid: string, messages: string[]) {
  const message = messages[1]
  const queue = JSON.parse(message) as ReceiveQueue
  logger.info({
    label: 'consume:message',
    message: queue
  })
  if (queue.user) {
    sendToUser(queue.user, Buffer.from(message))
  }
  await client().xack(STREAM, GROUP, ackid)
}

export async function consumeMessage(db: MongoClient) {
  const parser = createParser(db, message)
  await consumeGroup(GROUP, 'consume-backend', STREAM, parser)
}
