import type { Redis } from 'ioredis'

declare global {
  /* eslint-disable no-var */
  var testRedisClient: Redis
  /* eslint-enable no-var */
}
