import express, { type Request, type Response } from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import passport from 'passport'
import type { Redis } from 'ioredis'
import connectRedis from 'connect-redis'
import { Strategy as TwitterStrategy } from 'passport-twitter'
import { Strategy as GitHubStrategy } from 'passport-github'
import session from 'express-session'
import { logger } from './lib/logger.js'
import {
  TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET,
  TWITTER_CALLBACK_URL,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GITHUB_CALLBACK_URL,
  TRUST_PROXY,
  SESSION_PARSER
} from './config.js'
import * as handlers from './handlers.js'

type Options = {
  client: Redis
}

export const createApp = ({ client }: Options) => {
  const app = express()
  app.use(helmet())
  app.set('trust proxy', TRUST_PROXY)

  const RedisStore = connectRedis(session)

  const sessionParser = session({
    store: new RedisStore({ client: client }),
    ...SESSION_PARSER
  })

  app.use(sessionParser)

  app.use(passport.initialize())
  app.use(passport.session())

  passport.serializeUser(handlers.serializeUser)
  passport.deserializeUser(handlers.deserializeUser)

  passport.use(
    new TwitterStrategy(
      {
        consumerKey: TWITTER_CONSUMER_KEY,
        consumerSecret: TWITTER_CONSUMER_SECRET,
        callbackURL: TWITTER_CALLBACK_URL,
        includeEmail: true,
        passReqToCallback: true
      },
      (req, token, tokenSecret, profile, done) => {
        handlers.loginTwitter(req, profile.id, profile.username, done)
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
        handlers.loginGithub(req, profile.id, profile.username, done)
      }
    )
  )

  app.post('/auth/jwt/refresh', cookieParser(), (req, res) => {
    return handlers.jwtRefresh(req, res)
  })

  const callbackHandler = (
    req: Request & { user: handlers.SerializeUser },
    res: Response
  ) => {
    return res
      .cookie('mzm-jwt-token', req.user.accessToken)
      .cookie('mzm-jwt-refresh-token', req.user.refreshToken, {
        secure: true,
        httpOnly: true
      })
      .redirect('/login/success')
  }

  app.get('/auth/twitter', passport.authenticate('twitter'))
  app.get(
    '/auth/twitter/callback',
    passport.authenticate('twitter', { failureRedirect: '/' }),
    callbackHandler
  )
  app.delete('/auth/twitter', handlers.remoteTwitter)

  app.get('/auth/github', passport.authenticate('github'))
  app.get(
    '/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/' }),
    callbackHandler
  )
  app.delete('/auth/github', handlers.remoteGithub)

  app.get('/auth', handlers.auth)

  app.get('/auth/logout', (req: Request, res: Response) => {
    req.logout(() => {
      res
        .clearCookie('mzm-jwt-token')
        .clearCookie('mzm-jwt-refresh-token')
        .redirect('/')
    })
  })

  app.delete('/auth/user', handlers.remove)

  // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
  app.use((err, req, res, next) => {
    res.status(500).send('Internal Server Error')
    logger.error('[Internal Server Error]', err)
  })

  return app
}
