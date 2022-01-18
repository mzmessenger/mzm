import Redis from 'ioredis'
import * as config from '../config'

export const redis = new Redis(config.redis.options)

export const sessionRedis = new Redis(config.sessionRedis.options)
