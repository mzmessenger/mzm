import { type MongoClient, ObjectId } from 'mongodb'
import { type ExRedisClient, lock, release } from '../redis.js'
import { logger } from '../logger.js'
import * as config from '../../config.js'

export async function initConsumerGroup(
  client: ExRedisClient,
  stream: string,
  groupName: string
) {
  const lockKey =
    config.lock.INIT_CONSUMER_GROUP + ':' + stream + ':' + groupName
  const lockVal = new ObjectId().toHexString()
  const locked = await lock(client, lockKey, lockVal, 1000)

  if (!locked) {
    logger.info(`[locked] initConsumerGroup: ${lockKey}`)
    return
  }

  // create consumer group
  try {
    await client.xgroup('SETID', stream, groupName, '$')
  } catch (e) {
    try {
      await client.xgroup('CREATE', stream, groupName, '$', 'MKSTREAM')
    } catch (err) {
      if (`${err}`.includes('already exists')) {
        return
      }
      logger.error(`failed creating xgroup (${stream}, ${groupName}):`, e)
      throw err
    } finally {
      await release(client, lockKey, lockVal)
    }
  } finally {
    await release(client, lockKey, lockVal)
  }
}

export function createParser(
  {
    redis,
    db
  }: {
    redis: ExRedisClient
    db: MongoClient
  },
  handler: (args: {
    redis: ExRedisClient
    db: MongoClient
    ackId: string
    messages: string[]
  }) => Promise<void | null>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (read: any) => {
    if (!read) {
      return null
    }

    for (const [, val] of read) {
      for (const [ackId, messages] of val) {
        try {
          await handler({ redis, db, ackId, messages })
        } catch (e) {
          logger.error('parse error', e, ackId, messages)
        }
      }
    }
  }
}

export async function consumeGroup(
  client: ExRedisClient,
  groupName: string,
  consumerName: string,
  stream: string,
  parser: ReturnType<typeof createParser>
) {
  try {
    const res = await client.xreadgroup(
      'GROUP',
      groupName,
      consumerName,
      'COUNT',
      '100',
      'BLOCK',
      '10',
      'STREAMS',
      stream,
      '>'
    )
    await parser(res)
  } catch (e) {
    logger.error('[read]', stream, e)
  }
  await consumeGroup(client, groupName, consumerName, stream, parser)
}
