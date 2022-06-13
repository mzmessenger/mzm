import Redis from 'ioredis'
import { REDIS, SESSION_REDIS } from '../config.js'

export const redis = new Redis(REDIS.options)

export const sessionRedis = new Redis(SESSION_REDIS.options)
