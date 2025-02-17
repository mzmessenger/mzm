import type { Redis } from 'ioredis'
import type { PassportRequest, SerializeUser } from './types.js'
import express, { type Request } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import passport from 'passport'
import { RedisStore } from 'connect-redis'
import { Strategy as GitHubStrategy } from 'passport-github'
import { Strategy as TwitterStrategy } from 'passport-twitter'
import session from 'express-session'
import { createErrorHandler } from 'mzm-shared/src/lib/middleware'
import { wrap } from 'mzm-shared/src/lib/wrap'
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
  client: Redis
}

export const createApp = ({ client }: Options) => {
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
      store: new RedisStore({ client: client }),
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
    (req, res, next) => {
      return wrap(
        authorizeHandlers.createAuthorize(res as NonceResponse, client)
      )(req, res, next)
    }
  )

  passport.serializeUser(handlers.serializeUser)
  passport.deserializeUser(handlers.deserializeUser)

  app.post(
    '/auth/token',
    defaultHelmet,
    jsonParser,
    wrap(authorizeHandlers.token)
  )

  app.get('/auth/twitter', defaultHelmet, (req, res, next) => {
    oauthHandlers.oauth(passport, 'twitter')(req, res, next)
  })
  app.get(
    '/auth/twitter/callback',
    defaultHelmet,
    passport.authenticate('twitter', {
      keepSessionInfo: true,
      failureRedirect: '/auth/error'
    }),
    (req, res) => {
      oauthHandlers.oauthCallback(req as Request & { user: SerializeUser }, res)
    }
  )
  app.delete(
    '/auth/twitter',
    defaultHelmet,
    wrap(twitterHandlers.removeTwitter)
  )

  app.get('/auth/github', defaultHelmet, (req, res, next) => {
    oauthHandlers.oauth(passport, 'github')(req, res, next)
  })
  app.get(
    '/auth/github/callback',
    defaultHelmet,
    passport.authenticate('github', {
      keepSessionInfo: true,
      failureRedirect: '/auth/error'
    }),
    (req, res) => {
      oauthHandlers.oauthCallback(req as Request & { user: SerializeUser }, res)
    }
  )
  app.delete('/auth/github', defaultHelmet, wrap(githubHandlers.removeGithub))

  app.get('/auth/logout', defaultHelmet, handlers.logout)

  app.delete('/auth/user', defaultHelmet, wrap(handlers.remove))
  app.get('/auth/error', defaultHelmet, (_, res) =>
    res.redirect(ALLOW_REDIRECT_ORIGINS[0])
  )

  app.use(createErrorHandler(logger))

  return app
}
