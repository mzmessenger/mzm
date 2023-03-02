import { once } from 'node:events'
import { pid, kill } from 'node:process'
import Redis from 'ioredis'
import { REDIS, SESSION_REDIS } from '../config.js'
import { logger } from './logger.js'

export let redis: Redis = null

export let sessionRedis: Redis = null

export const connect = async () => {
  redis = new Redis(REDIS.options)
  redis.on('error', (e) => {
    logger.error('[redis]', 'error', e, pid)
    kill(pid, 'SIGTERM')
  })

  sessionRedis = new Redis(SESSION_REDIS.options)
  sessionRedis.on('error', (e) => {
    logger.error('[sessionRedis]', 'error', e)
    kill(process.pid, 'SIGTERM')
  })

  await Promise.all([once(redis, 'ready'), once(sessionRedis, 'ready')])

  logger.info('[redis] connected')
}
