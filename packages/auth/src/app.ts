import type { Redis } from 'ioredis'
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import passport from 'passport'
import RedisStore from 'connect-redis'
import { Strategy as GitHubStrategy } from 'passport-github'
import { Strategy as Oauth2Strategy } from 'passport-oauth2'
import session from 'express-session'
import { logger } from './lib/logger.js'
import {
  TWITTER_CLIENT_ID,
  TWITTER_CLIENT_SECRET,
  TWITTER_CALLBACK_URL,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL,
  TRUST_PROXY,
  SESSION_PARSER,
  CLIENT_URL_BASE,
  CORS_ORIGIN
} from './config.js'
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
    'twitter-oauth2',
    new Oauth2Strategy(
      {
        authorizationURL: 'https://twitter.com/i/oauth2/authorize',
        tokenURL: 'https://api.twitter.com/2/oauth2/token',
        clientID: TWITTER_CLIENT_ID,
        clientSecret: TWITTER_CLIENT_SECRET,
        callbackURL: TWITTER_CALLBACK_URL,
        pkce: true,
        state: true,
        scope: ['users.read']
      },
      (req, accessToken, refreshToken, profile, done) => {
        twitterHandlers.loginTwitter(req, profile.id, profile.username, done)
      }
    )
  )

  passport.use(
    'github',
    new GitHubStrategy(
      {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: GITHUB_CALLBACK_URL,
        passReqToCallback: true
      },
      (req, accessToken, refreshToken, profile, done) => {
        githubHandlers.loginGithub(req, profile.id, profile.username, done)
      }
    )
  )

  app.get(
    '/authorize',
    authorizeHandlers.createNonceMiddleware,
    helmet({
      contentSecurityPolicy: {
        directives: {
          scriptSrc: [
            "'self'",
            (req, res: authorizeHandlers.AuthorizationResponse) => {
              return `'nonce-${res.locals.nonce}'`
            }
          ],
          frameAncestors: ["'self'", CLIENT_URL_BASE]
        }
      }
    }),
    authorizeHandlers.authorize
  )

  passport.serializeUser(handlers.serializeUser)
  passport.deserializeUser(handlers.deserializeUser)

  app.post('/auth/token', defaultHelmet, jsonParser, authorizeHandlers.token)

  app.get(
    '/auth/twitter',
    defaultHelmet,
    oauthHandlers.oauth(client, passport, 'twitter-oauth2')
  )
  app.get(
    '/auth/twitter/callback',
    defaultHelmet,
    passport.authenticate('twitter-oauth2', { failureRedirect: '/' }),
    oauthHandlers.oauthCallback
  )
  app.delete('/auth/twitter', defaultHelmet, twitterHandlers.removeTwitter)

  app.get(
    '/auth/github',
    defaultHelmet,
    oauthHandlers.oauth(client, passport, 'github')
  )
  app.get(
    '/auth/github/callback',
    defaultHelmet,
    passport.authenticate('github', { failureRedirect: '/' }),
    oauthHandlers.oauthCallback
  )
  app.delete('/auth/github', defaultHelmet, githubHandlers.removeGithub)

  app.get('/auth/logout', defaultHelmet, (req: Request, res: Response) => {
    req.logout(() => {
      res.redirect(CLIENT_URL_BASE)
    })
  })

  app.delete('/auth/user', defaultHelmet, handlers.remove)

  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  app.use((err, req, res, next) => {
    res.status(500).send('Internal Server Error')
    logger.error('[Internal Server Error]', err)
  })

  return app
}
