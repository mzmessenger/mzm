import { once } from 'node:events'
import { Redis, type RedisOptions } from 'ioredis'
import { logger } from './logger.js'

const releaseScript = `if redis.call("get",KEYS[1]) == ARGV[1] then
    return redis.call("del",KEYS[1])
else
    return 0
end`

export type ExRedisClient = Redis & {
  release: (key: string, val: string) => Promise<void>
}

export async function connect(options: RedisOptions) {
  const client = new Redis({
    ...options,
    reconnectOnError(err) {
      if (err.message.includes('ECONNRESET')) {
        return true
      }
      return false
    }
  }) as ExRedisClient

  client.on('error', function error(e) {
    logger.error('[redis]', 'error', e)
  })

  client.defineCommand('release', {
    lua: releaseScript,
    numberOfKeys: 1
  })

  await once(client, 'ready')

  logger.info('[redis] connected')

  return client
}

export const lock = async (
  client: ExRedisClient,
  key: string,
  val: string,
  millisec: number
) => {
  try {
    const res = await client.set(key, val, 'PX', millisec, 'NX')
    return (res || '').toLocaleLowerCase().includes('ok')
  } catch (e) {
    return false
  }
}

export const release = async (
  client: ExRedisClient,
  key: string,
  val: string
) => {
  return await client.release(key, val)
}
