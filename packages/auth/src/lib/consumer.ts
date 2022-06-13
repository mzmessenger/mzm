import { ObjectId } from 'mongodb'
import { redis } from './redis.js'
import { logger } from './logger.js'
import * as db from './db.js'
import { REMOVE_STREAM } from '../config.js'

const REMOVE_STREAM_TO_CHAT = 'stream:backend:remove:user'
const REMOVE_GROUP = 'group:auth:remove:user'

const initConsumerGroup = async (stream: string, groupName: string) => {
  // create consumer group
  try {
    await redis.xgroup('SETID', stream, groupName, '$')
  } catch (e) {
    try {
      await redis.xgroup('CREATE', stream, groupName, '$', 'MKSTREAM')
    } catch (e) {
      if (e.toSring().includes('already exists')) {
        return
      }
      logger.error(`failed creating xgroup (${stream}, ${groupName}):`, e)
      throw e
    }
  }
}

export const initRemoveConsumerGroup = async () => {
  await initConsumerGroup(REMOVE_STREAM, REMOVE_GROUP)
}

const remove = async (id: string, user: string) => {
  const userId = new ObjectId(user)
  const target = await db.collections.users.findOne({ _id: userId })
  logger.info('[consumer:remove]', user, target)
  if (!target) {
    return
  }
  const remove = { ...target, originId: target._id }
  delete remove['_id']
  await db.collections.removed.findOneAndUpdate(
    { originId: userId },
    { $set: remove },
    { upsert: true }
  )
  await db.collections.users.deleteOne({ _id: target._id })
  await redis.xadd(REMOVE_STREAM_TO_CHAT, '*', 'user', user)
  await redis.xack(REMOVE_STREAM, REMOVE_GROUP, id)
  logger.info('[remove:user]', user)
}

export const parser = async (read) => {
  if (!read) {
    return
  }

  for (const [, val] of read) {
    for (const [id, messages] of val) {
      try {
        const user = messages[1]
        await remove(id, user)
      } catch (e) {
        logger.error('parse error', e, id, messages)
      }
    }
  }
}

export const consume = async () => {
  try {
    const res = await redis.xreadgroup(
      'GROUP',
      REMOVE_GROUP,
      'consume-auth',
      'COUNT',
      '100',
      'BLOCK',
      '100',
      'STREAMS',
      REMOVE_STREAM,
      '>'
    )
    await parser(res)
  } catch (e) {
    logger.error('[read]', REMOVE_STREAM, e)
  }

  await consume()
}
