import { ObjectId } from 'mongodb'
import { client, lock, release } from '../redis.js'
import { logger } from '../logger.js'
import * as config from '../../config.js'

export const initConsumerGroup = async (stream: string, groupName: string) => {
  const lockKey =
    config.lock.INIT_CONSUMER_GROUP + ':' + stream + ':' + groupName
  const lockVal = new ObjectId().toHexString()
  const locked = await lock(lockKey, lockVal, 1000)

  if (!locked) {
    logger.info(`[locked] initConsumerGroup: ${lockKey}`)
    return
  }

  // create consumer group
  try {
    await client().xgroup('SETID', stream, groupName, '$')
  } catch (e) {
    try {
      await client().xgroup('CREATE', stream, groupName, '$', 'MKSTREAM')
    } catch (err) {
      if (`${err}`.includes('already exists')) {
        return
      }
      logger.error(`failed creating xgroup (${stream}, ${groupName}):`, e)
      throw err
    } finally {
      await release(lockKey, lockVal)
    }
  } finally {
    await release(lockKey, lockVal)
  }
}

export const createParser = (
  handler: (id: string, messages: string[]) => Promise<void | null>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (read: any) => {
    if (!read) {
      return null
    }

    for (const [, val] of read) {
      for (const [id, messages] of val) {
        try {
          await handler(id, messages)
        } catch (e) {
          logger.error('parse error', e, id, messages)
        }
      }
    }
  }
}

export const consumeGroup = async (
  groupName: string,
  consumerName: string,
  stream: string,
  parser: ReturnType<typeof createParser>
) => {
  try {
    const res = await client().xreadgroup(
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
  await consumeGroup(groupName, consumerName, stream, parser)
}
