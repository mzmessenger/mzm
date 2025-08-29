import type { MongoClient } from 'mongodb'
import type { Redis } from 'ioredis'
import type { PassportRequest, SerializeUser } from './types.js'
import express, { type Request } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import passport from 'passport'
import MongoStore from 'connect-mongo'
import { Strategy as GitHubStrategy } from 'passport-github'
import { Strategy as TwitterStrategy } from 'passport-twitter'
import session from 'express-session'
import { createErrorHandler } from 'mzm-shared/src/lib/middleware'
import { response } from 'mzm-shared/src/lib/wrap'
import {
  TWITTER_STRATEGY_OPTIONS,
  GITHUB_STRATEGY_OPTIONS,
  TRUST_PROXY,
  SESSION_PARSER,
  ALLOW_REDIRECT_ORIGINS,
  CORS_ORIGIN
} from './config.js'
import { logger } from './lib/logger.js'
import {
  createNonceMiddleware,
  type NonceResponse
} from './middleware/index.js'
import * as handlers from './handlers/index.js'
import * as oauthHandlers from './handlers/oauth.js'
import * as githubHandlers from './handlers/github.js'
import * as twitterHandlers from './handlers/twitter.js'
import * as authorizeHandlers from './handlers/authorize.js'

const jsonParser = express.json({ limit: '1mb' })

type Options = {
  db: MongoClient
  redis: Redis
  sessionClientPromise: Promise<MongoClient>
}

export function createApp({ db, redis, sessionClientPromise }: Options) {
  const app = express()
  const defaultHelmet = helmet()
  app.use(
    cors({
      origin: CORS_ORIGIN
    })
  )
  app.set('trust proxy', TRUST_PROXY)
  app.use(
    session({
      store: MongoStore.create({ clientPromise: sessionClientPromise }),
      ...SESSION_PARSER
    })
  )
  app.use(passport.initialize())
  app.use(passport.session())

  app.get('/', defaultHelmet, (_, res) => {
    res.status(200).send('ok')
  })

  passport.use(
    'twitter',
    new TwitterStrategy(
      TWITTER_STRATEGY_OPTIONS,
      (req, accessToken, refreshToken, profile, done) => {
        twitterHandlers.loginTwitter(
          req as unknown as PassportRequest,
          db,
          profile.id,
          profile.username,
          done
        )
      }
    )
  )

  passport.use(
    'github',
    new GitHubStrategy(
      GITHUB_STRATEGY_OPTIONS,
      (req, accessToken, refreshToken, profile, done) => {
        githubHandlers.loginGithub(
          req as PassportRequest,
          db,
          profile.id,
          profile.username,
          done
        )
      }
    )
  )

  app.get(
    '/authorize',
    createNonceMiddleware,
    helmet({
      contentSecurityPolicy: {
        directives: {
          scriptSrc: [
            "'self'",
            (req, res) => {
              const { locals } = res as NonceResponse
              return `'nonce-${locals.nonce}'`
            }
          ],
          frameAncestors: ["'self'", ...ALLOW_REDIRECT_ORIGINS]
        }
      }
    }),
    async (req, res) => {
      const html = await authorizeHandlers.createAuthorize(db)(
        req,
        res as NonceResponse
      )
      return response(html)(req, res)
    }
  )

  passport.serializeUser(handlers.createSerializeUser())
  passport.deserializeUser(handlers.createDeserializeUserHandler(db))

  app.post('/auth/token', defaultHelmet, jsonParser, async (req, res) => {
    const data = await authorizeHandlers.createTokenHandler(db)(req)
    return response(data)(req, res)
  })

  app.get('/auth/twitter', defaultHelmet, (req, res, next) => {
    oauthHandlers.oauthHandler(passport, 'twitter')(req, res, next)
  })
  app.get(
    '/auth/twitter/callback',
    defaultHelmet,
    passport.authenticate('twitter', {
      keepSessionInfo: true,
      failureRedirect: '/auth/error'
    }),
    (req, res) => {
      oauthHandlers.oauthCallback(db)(
        req as Request & { user: SerializeUser },
        res
      )
    }
  )
  app.delete('/auth/twitter', defaultHelmet, async (req, res) => {
    const data = await twitterHandlers.removeTwitter(req, db)
    return response(data)(req, res)
  })

  app.get('/auth/github', defaultHelmet, (req, res, next) => {
    oauthHandlers.oauthHandler(passport, 'github')(req, res, next)
  })
  app.get(
    '/auth/github/callback',
    defaultHelmet,
    passport.authenticate('github', {
      keepSessionInfo: true,
      failureRedirect: '/auth/error'
    }),
    (req, res) => {
      oauthHandlers.oauthCallback(db)(
        req as Request & { user: SerializeUser },
        res
      )
    }
  )
  app.delete('/auth/github', defaultHelmet, async (req, res) => {
    const data = await githubHandlers.removeGithub(req, db)
    return response(data)(req, res)
  })

  app.get('/auth/logout', defaultHelmet, handlers.logout)

  app.delete('/auth/user', defaultHelmet, async (req, res) => {
    const data = await handlers.remove(req, redis)
    return response(data)(req, res)
  })
  app.get('/auth/error', defaultHelmet, (_, res) =>
    res.redirect(ALLOW_REDIRECT_ORIGINS[0])
  )

  app.use(createErrorHandler(logger))

  return app
}
