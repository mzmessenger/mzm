import { once } from 'node:events'
import { Redis } from 'ioredis'
import { REDIS, SESSION_REDIS } from '../config.js'
import { logger } from './logger.js'

export let redis: Redis | null = null

export let sessionRedis: Redis | null = null

export const connect = async () => {
  redis = new Redis(REDIS.options)
  redis.on('error', (e) => {
    logger.error('[redis]', 'error', e)
    process.exit(1)
  })

  sessionRedis = new Redis(SESSION_REDIS.options)
  sessionRedis.on('error', (e) => {
    logger.error('[sessionRedis]', 'error', e)
    process.exit(1)
  })

  await Promise.all([once(redis, 'ready'), once(sessionRedis, 'ready')])

  logger.info('[redis] connected')
  return {
    redis,
    sessionRedis
  }
}
