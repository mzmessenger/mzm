import type * as configType from '../src/config.js'
import { getTestRedisClient, getTestMongoClient } from './testUtil.js'

export const mockConfig = {
  JWT: {
    accessTokenSecret: 'mzmTestAccessTokenSecret',
    refreshTokenSecret: 'mzmTestRefreshTokenSecret',
    issuer: 'https://test.mzm.dev',
    audience: ['https://test.mzm.dev']
  } satisfies typeof configType.JWT
}

export const mockLogger = {
  logger: {
    info: () => {},
    error: () => {}
  }
}

export const mockRedis = async () => {
  const { sessionRedis } = await getTestRedisClient()
  return {
    sessionRedis
  }
}

export const mockDb = async (actual: typeof import('../src/lib/db.js')) => {
  const client = await getTestMongoClient()
  return {
    ...actual,
    mongoClient: () => client
  }
}
