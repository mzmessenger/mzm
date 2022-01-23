import Redis from 'ioredis'
import * as config from '../config'

const releaseScript = `if redis.call("get",KEYS[1]) == ARGV[1] then
    return redis.call("del",KEYS[1])
else
    return 0
end`

export const connect = async () => {
  client = new Redis(config.redis.options)

  client.defineCommand('release', {
    lua: releaseScript,
    numberOfKeys: 1
  })
}

export let client: Redis.Redis = null

export const lock = async (key: string, val: string, millisec: number) => {
  try {
    const res = await client.set(key, val, 'PX', millisec, 'NX')
    return (res || '').toLocaleLowerCase().includes('ok')
  } catch (e) {
    return false
  }
}

export const release = async (key: string, val: string) => {
  return await (client as any).release(key, val)
}
