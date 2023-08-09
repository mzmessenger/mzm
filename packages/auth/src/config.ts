import type { SessionOptions } from 'express-session'
import type { RedisOptions } from 'ioredis'
import type { StrategyOptions as Oauth2StrategyOptions } from 'passport-oauth2'
import type { StrategyOptionsWithRequest as GitHubStrategyOptions } from 'passport-github'
import { config } from 'dotenv'

const isTest = process.env.NODE_ENV !== 'test'

if (!isTest) {
  config()
}

export const CLIENT_URL_BASE =
  process.env.CLIENT_URL_BASE ?? 'http://localhost:8080'

export const TWITTER_STRATEGY_OPTIONS = {
  authorizationURL: 'https://twitter.com/i/oauth2/authorize',
  tokenURL: 'https://api.twitter.com/2/oauth2/token',
  clientID: process.env.TWITTER_CLIENT_ID!,
  clientSecret: process.env.TWITTER_CLIENT_SECRET!,
  callbackURL: process.env.TWITTER_CALLBACK_URL,
  pkce: true,
  state: true,
  scope: ['users.read'] satisfies string[]
} as const satisfies Oauth2StrategyOptions

export const GITHUB_STRATEGY_OPTIONS = {
  clientID: process.env.GITHUB_CLIENT_ID!,
  clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  callbackURL: process.env.GITHUB_CALLBACK_URL!,
  passReqToCallback: true
} as const satisfies GitHubStrategyOptions

export const MONGODB_URI = process.env.MONGODB_URI!

export const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((e) => e.trim())
  : ['http://localhost', 'http://localhost:8080']

export const WORKER_NUM = Number(process.env.WORKER_NUM) ?? 1

export const PORT = process.env.PORT ?? 3002

export const REMOVE_STREAM = 'stream:auth:remove:user'

export const REDIS = {
  options: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
      ? Number(process.env.SESSION_REDIS_PORT)
      : 6379,
    enableOfflineQueue: false,
    connectTimeout: Number(process.env.REDIS_TIMEOUT) ?? 30000
  } satisfies RedisOptions
} as const

export const SESSION_REDIS = {
  options: {
    host: process.env.SESSION_REDIS_HOST,
    port: process.env.SESSION_REDIS_PORT
      ? Number(process.env.SESSION_REDIS_PORT)
      : 6379,
    enableOfflineQueue: false,
    connectTimeout: Number(process.env.SESSION_REDIS_TIMEOUT) ?? 30000,
    db: 1
  } satisfies RedisOptions
} as const

export const SESSION_PARSER: SessionOptions = {
  name: process.env.SESSION_NAME ?? 'mzm',
  secret: process.env.SESSION_SECRET!,
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

export const JWT = {
  accessTokenSecret: isTest
    ? 'mzmTestAccessTokenSecret'
    : process.env.ACCESS_TOKEN_SECRET!,
  refreshTokenSecret: isTest
    ? 'mzmTestRefreshTokenSecret'
    : process.env.REFRESH_TOKEN_SECRET!,
  issuer: process.env.JWT_ISSURE ?? 'https://mzm.dev',
  audience: process.env.JWT_AUDIENCE
    ? process.env.JWT_AUDIENCE.split(',')
    : (['https://mzm.dev'] satisfies string[])
} as const
