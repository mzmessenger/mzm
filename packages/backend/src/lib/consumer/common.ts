import { ObjectId } from 'mongodb'
import { client, lock, release } from '../redis'
import { logger } from '../logger'
import * as config from '../../config'

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
    await client.xgroup('setid', stream, groupName, '$')
  } catch (e) {
    try {
      await client.xgroup('create', stream, groupName, '$', 'MKSTREAM')
    } catch (e) {
      if (e?.toSring().includes('already exists')) {
        return
      }
      logger.error(`failed creating xgroup (${stream}, ${groupName}):`, e)
      throw e
    } finally {
      await release(lockKey, lockVal)
    }
  } finally {
    await release(lockKey, lockVal)
  }
}

export const createParser = (
  handler: (id: string, messages: string[]) => Promise<any>
) => {
  return async (read) => {
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
    const res = await client.xreadgroup(
      'group',
      groupName,
      consumerName,
      'BLOCK',
      '10',
      'COUNT',
      '100',
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
