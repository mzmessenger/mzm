import { config } from 'dotenv'
import type { SessionOptions } from 'express-session'
config()

export const {
  MONGODB_URI,
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET,
  TWITTER_CALLBACK_URL,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL
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

export const SESSION_PARSER: SessionOptions = {
  name: process.env.SESSION_NAME,
  secret: process.env.SESSION_SECRET,
  resave: false,
  rolling: true,
  saveUninitialized: false,
  cookie: {
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === 'true'
      : 'auto',
    maxAge: 24 * 60 * 60 * 1000 * 30 * 12 * 2
  }
} as const

export const TRUST_PROXY = process.env.TRUST_PROXY ?? 1

export const SESSION_NAME = process.env.SESSION_NAME ?? 'mzm'

export const JWT = {
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET
} as const
