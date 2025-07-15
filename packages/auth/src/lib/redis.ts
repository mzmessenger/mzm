import { once } from 'node:events'
import { Redis } from 'ioredis'
import { REDIS } from '../config.js'
import { logger } from './logger.js'

export let redis: Redis | null = null

export const connect = async () => {
  redis = new Redis({
    ...REDIS.options,
    reconnectOnError(err) {
      if (err.message.includes('ECONNRESET')) {
        return true
      }
      return false
    }
  })
  redis.on('error', (e) => {
    logger.error('[redis]', 'error', e)
  })

  await Promise.all([once(redis, 'ready')])

  logger.info('[redis] connected')
  return {
    redis
  }
}
