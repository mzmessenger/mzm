import Redis from 'ioredis'
import * as config from '../config'

const redis = new Redis(config.redis.options)

export default redis
