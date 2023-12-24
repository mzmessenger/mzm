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

export const initMessageConsumerGroup = async () => {
  await initConsumerGroup(STREAM, GROUP)
}

export const message = async (ackid: string, messages: string[]) => {
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

export const consumeMessage = async () => {
  const parser = createParser(message)
  await consumeGroup(GROUP, 'consume-backend', STREAM, parser)
}
