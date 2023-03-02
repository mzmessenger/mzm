import { pid, kill } from 'node:process'
import { once } from 'node:events'
import Redis from 'ioredis'
import { logger } from './logger.js'
import * as config from '../config.js'

export let redis: Redis = null

export const connect = async () => {
  redis = new Redis(config.REDIS.options)

  redis.on('error', function error(e) {
    logger.error(e)
    kill(pid, 'SIGTERM')
  })

  await once(redis, 'ready')

  logger.info('[redis] connected')
}
