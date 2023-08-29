import { once } from 'node:events'
import { Redis } from 'ioredis'
import { logger } from './logger.js'
import * as config from '../config.js'

let _redis: Redis | null = null

export const redis = () => {
  if (!_redis) {
    throw Error('not connected')
  }
  return _redis
}

export const connect = async () => {
  _redis = new Redis({
    ...config.REDIS.options,
    reconnectOnError(err) {
      if (err.message.includes('ECONNRESET')) {
        return true
      }
      return false
    }
  })

  _redis.on('error', function error(e) {
    logger.error('[redis]', 'error', e)
  })

  await once(_redis, 'ready')

  logger.info('[redis] connected')
}
