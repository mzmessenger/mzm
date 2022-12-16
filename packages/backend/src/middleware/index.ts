import { Request, Response, NextFunction } from 'express'
import {
  requestAuthServer,
  verifyAccessToken,
  parseAuthorizationHeader
} from 'mzm-shared/auth/index'
import { HEADERS } from 'mzm-shared/auth/constants'
import { AUTH_SERVER, JWT } from '../config.js'
import * as HttpErrors from '../lib/errors.js'
import { logger } from '../lib/logger.js'

const allHttpErrors = Object.keys(HttpErrors).map((err) => HttpErrors[err])

export const errorHandler = (err, _req, res: Response, _next) => {
  if (allHttpErrors.some((type) => err instanceof type)) {
    return res.status(err.status).send(err.toResponse())
  }
  res.status(500).send('Internal Server Error')
  logger.error('[Internal Server Error]', err)
}

export const checkAccessToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const accessToken = parseAuthorizationHeader(req)
  if (!accessToken) {
    return res.status(401).send('no authorization header')
  }

  verifyAccessToken(accessToken, JWT.accessTokenSecret)
    .then(({ err, decoded }) => {
      if (err) {
        return res.status(402).send('token expired')
      }
      if (!decoded) {
        return res.status(401).send('not login')
      }
      req.headers[HEADERS.USER_ID] = decoded.user._id
      next()
    })
    .catch(() => {
      return res.status(401).send('not login')
    })
}

export const checkLogin = (req: Request, res: Response, next: NextFunction) => {
  try {
    requestAuthServer({
      url: AUTH_SERVER,
      headers: {
        cookie: req.headers.cookie
      }
    })
      .then(({ userId, twitterUserName, githubUserName }) => {
        if (!userId) {
          return res.status(401).send('not login')
        }
        req.headers[HEADERS.USER_ID] = userId
        req.headers[HEADERS.TIWTTER_USER_NAME] = twitterUserName
        req.headers[HEADERS.GITHUB_USER_NAME] = githubUserName
        next()
      })
      .catch(() => {
        return res.status(401).send('not login')
      })
  } catch (e) {
    next(e)
  }
}
