import type { MongoClient } from 'mongodb'
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
  CORS_ORIGIN,
  QUEUE_CALLBACK_SECRET
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
import { removeUser } from './lib/consumer.js'
import { GATEWAY_ORIGIN_SECRET } from './config.js'
import {
  acknowledgeOutbox,
  claimOutbox,
  outboxState,
  releaseOutbox
} from './lib/outbox.js'
import { MAX_QUEUE_BATCH_MESSAGES } from 'mzm-shared/src/lib/outbox'

const jsonParser = express.json({ limit: '1mb' })

type Options = {
  db: MongoClient
  sessionClientPromise: Promise<MongoClient>
}

export function createApp({ db, sessionClientPromise }: Options) {
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

  app.use('/internal/outbox/v1', (req, res, next) => {
    if (
      !GATEWAY_ORIGIN_SECRET ||
      req.headers['x-mzm-gateway-authorization'] !==
        `Bearer ${GATEWAY_ORIGIN_SECRET}`
    )
      return res.status(401).send('unauthorized')
    next()
  })
  app.post('/internal/outbox/v1/claim', jsonParser, async (req, res) => {
    const { owner, operationId, limit } = req.body
    if (
      typeof owner !== 'string' ||
      (operationId !== undefined && typeof operationId !== 'string') ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_QUEUE_BATCH_MESSAGES
    )
      return res.status(400).send('invalid claim')
    return res.json(await claimOutbox(db, owner, operationId, limit))
  })
  app.post('/internal/outbox/v1/ack', jsonParser, async (req, res) => {
    const { owner, events } = req.body
    if (
      typeof owner !== 'string' ||
      !Array.isArray(events) ||
      !events.every(
        (event) =>
          event &&
          typeof event === 'object' &&
          typeof event.eventId === 'string' &&
          Number.isInteger(event.eventIndex)
      )
    )
      return res.status(400).send('invalid acknowledgement')
    return res.sendStatus(
      (await acknowledgeOutbox(db, owner, events)) ? 204 : 409
    )
  })
  app.post('/internal/outbox/v1/release', jsonParser, async (req, res) => {
    const { owner, events } = req.body
    if (
      typeof owner !== 'string' ||
      !Array.isArray(events) ||
      !events.every(
        (event) =>
          event &&
          typeof event === 'object' &&
          typeof event.eventId === 'string' &&
          Number.isInteger(event.eventIndex)
      )
    )
      return res.status(400).send('invalid release')
    return res.sendStatus((await releaseOutbox(db, owner, events)) ? 204 : 409)
  })
  app.post('/internal/outbox/v1/state', jsonParser, async (req, res) => {
    if (typeof req.body?.operationId !== 'string')
      return res.status(400).send('invalid operation')
    return res.json(await outboxState(db, req.body.operationId))
  })

  app.post('/internal/queue/remove-user', jsonParser, async (req, res) => {
    if (
      !QUEUE_CALLBACK_SECRET ||
      req.headers.authorization !== `Bearer ${QUEUE_CALLBACK_SECRET}`
    ) {
      res.status(401).send('invalid queue secret')
      return
    }
    await removeUser({ db, event: req.body })
    res.status(204).send()
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
    if (
      !GATEWAY_ORIGIN_SECRET ||
      req.headers['x-mzm-gateway-authorization'] !==
        `Bearer ${GATEWAY_ORIGIN_SECRET}`
    )
      return res.status(401).send('unauthorized')
    const data = await handlers.remove(req, db)
    res.set('x-mzm-operation-id', data.operationId)
    return response(data)(req, res)
  })
  app.get('/auth/error', defaultHelmet, (_, res) =>
    res.redirect(ALLOW_REDIRECT_ORIGINS[0])
  )

  app.use(createErrorHandler(logger))

  return app
}
