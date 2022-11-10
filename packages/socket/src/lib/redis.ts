import Redis from 'ioredis'
import * as config from '../config.js'

const redis = new Redis(config.REDIS.options)

export default redis
