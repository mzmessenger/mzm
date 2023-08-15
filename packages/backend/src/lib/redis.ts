import { once } from 'node:events'
import { Redis } from 'ioredis'
import { logger } from './logger.js'
import * as config from '../config.js'

const releaseScript = `if redis.call("get",KEYS[1]) == ARGV[1] then
    return redis.call("del",KEYS[1])
else
    return 0
end`

type ExRedisClient = Redis & {
  release: (key: string, val: string) => Promise<void>
}

export const connect = async () => {
  _client = new Redis(config.redis.options) as ExRedisClient

  _client.on('error', function error(e) {
    logger.error('[redis]', 'error', e)
    process.exit(1)
  })

  _client.defineCommand('release', {
    lua: releaseScript,
    numberOfKeys: 1
  })

  await once(_client, 'ready')

  logger.info('[redis] connected')
}

let _client: ExRedisClient | null = null

export const client = () => {
  if (!_client) {
    throw new Error('redis client not initialized')
  }
  return _client
}

export const lock = async (key: string, val: string, millisec: number) => {
  try {
    const res = await client().set(key, val, 'PX', millisec, 'NX')
    return (res || '').toLocaleLowerCase().includes('ok')
  } catch (e) {
    return false
  }
}

export const release = async (key: string, val: string) => {
  return await client().release(key, val)
}
