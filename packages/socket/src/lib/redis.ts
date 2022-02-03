import Redis from 'ioredis'
import * as config from '../config'

const redis = new Redis(config.REDIS.options)

export default redis
