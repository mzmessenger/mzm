import redis from './redis'
import logger from './logger'
import { sendToUser } from './sender'

type ReceiveQueue = {
  user?: string
  socket?: string
  cmd: string
}

const READ_STREAM = 'stream:socket:message'

export const parser = async (read) => {
  if (!read) {
    return
  }

  let nextId = null

  for (const [, val] of read) {
    for (const [id, messages] of val) {
      nextId = id
      try {
        const queue = JSON.parse(messages[1]) as ReceiveQueue
        if (queue.user) {
          sendToUser(queue.user, queue)
        }
      } catch (e) {
        logger.error('parse error', e, id, messages)
      }
    }
  }

  return nextId
}

export const consume = async (startId: string = '$') => {
  let nextId = startId ? startId : '$'

  try {
    const res = await redis.xread(
      'BLOCK',
      '0',
      'COUNT',
      '100',
      'STREAMS',
      READ_STREAM,
      startId
    )
    nextId = await parser(res)
  } catch (e) {
    logger.error('[read]', 'stream:socket:message', e)
  }
  if (!nextId) {
    nextId = '$'
  }
  await consume(nextId)
}
