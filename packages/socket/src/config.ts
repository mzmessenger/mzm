import { config } from 'dotenv'
config()

export const WORKER_NUM = process.env.WORKER_NUM ?? 1

export const PORT: number = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : 3000

export const INTERNAL_API_URL = process.env.INTERNAL_API

export const REDIS = {
  options: {
    host: process.env.REDIS_HOST,
    enableOfflineQueue: false
  }
}
export const JWT = {
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
  issuer: process.env.JWT_ISSURE ?? 'https://mzm.dev',
  audience: process.env.JWT_AUDIENCE
    ? process.env.JWT_AUDIENCE.split(',')
    : (['https://mzm.dev'] as string[])
} as const
