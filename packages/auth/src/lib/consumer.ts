import type { Redis } from 'ioredis'
import { ObjectId, type MongoClient } from 'mongodb'
import { logger } from './logger.js'
import { collections } from './db.js'
import { REMOVE_STREAM } from '../config.js'

const REMOVE_STREAM_TO_CHAT = 'stream:backend:remove:user'
const REMOVE_GROUP = 'group:auth:remove:user'

async function initConsumerGroup(
  client: Redis,
  stream: string,
  groupName: string
) {
  // create consumer group
  try {
    await client.xgroup('SETID', stream, groupName, '$')
  } catch (e) {
    try {
      await client.xgroup('CREATE', stream, groupName, '$', 'MKSTREAM')
    } catch (err) {
      if (err?.toString().includes('already exists')) {
        return
      }
      logger.error(`failed creating xgroup (${stream}, ${groupName}):`, err)
      throw err
    }
  }
}

export async function initRemoveConsumerGroup(client: Redis) {
  await initConsumerGroup(client, REMOVE_STREAM, REMOVE_GROUP)
}

async function remove(client: Redis, db: MongoClient, id: string, user: string) {
  const userId = new ObjectId(user)
  const target = await collections(db).users.findOne({ _id: userId })
  logger.info({
    label: 'consumer:remove',
    message: 'consumer:remove',
    user,
    target
  })
  if (!target) {
    return
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ..._target } = target
  const remove = { ..._target, originId: target._id }
  await collections(db).removed.findOneAndUpdate(
    { originId: userId },
    { $set: remove },
    { upsert: true }
  )
  await collections(db).users.deleteOne({ _id: target._id })
  await client.xadd(REMOVE_STREAM_TO_CHAT, '*', 'user', user)
  await client.xack(REMOVE_STREAM, REMOVE_GROUP, id)
  logger.info({
    label: 'remove:user',
    user
  })
}

export async function parser(
  client: Redis,
  db: MongoClient,
  read: [unknown, [string, string[]]][]
) {
  if (!read) {
    return
  }

  for (const [, val] of read) {
    for (const [id, messages] of val) {
      try {
        const user = messages[1]
        logger.info({
          label: 'queue',
          message: user
        })
        await remove(client, db, id, user)
      } catch (e) {
        logger.error('parse error', e, id, messages)
      }
    }
  }
}

export async function consume(client: Redis, db: MongoClient) {
  try {
    const res = await client.xreadgroup(
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await parser(client, db, res as any)
  } catch (e) {
    logger.error('[read]', REMOVE_STREAM, e)
  }

  await consume(client, db)
}
