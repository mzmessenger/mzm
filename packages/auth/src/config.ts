import { config } from 'dotenv'
config()

export const {
  MONGODB_URI,
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET,
  TWITTER_CALLBACK_URL,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL,
  SESSION_SECRET
} = process.env

export const WORKER_NUM = process.env.WORKER_NUM ?? 1

export const PORT = process.env.PORT ?? 8000

export const REMOVE_STREAM = 'stream:auth:remove:user'

export const REDIS = {
  options: {
    host: process.env.REDIS_HOST,
    enableOfflineQueue: false
  }
} as const

export const SESSION_REDIS = {
  options: {
    host: process.env.SESSION_REDIS_HOST,
    enableOfflineQueue: false,
    db: 1
  }
} as const

export const dev = process.env.NODE_ENV !== 'production'

export const TRUST_PROXY = process.env.TRUST_PROXY ?? 1

export const SESSION_NAME = process.env.SESSION_NAME ?? 'mzm'
