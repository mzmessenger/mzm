import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { HEADERS, requestAuthServer } from 'mzm-shared/auth'
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

export const checkJwt = (req: Request, res: Response, next: NextFunction) => {
  const authorizationHeaderKey = Object.prototype.hasOwnProperty.call(
    req.headers,
    'Authorization'
  )
    ? 'Authorization'
    : 'authorization'
  const authorization = req.headers[authorizationHeaderKey] as string
  if (!authorization) {
    return res.status(401).send('no authorization header')
  }

  const [, _credentials] = authorization.split(' ')
  const credentials = (_credentials ?? '').trim()
  if (!credentials) {
    return res.status(401).send('no authorization header')
  }
  jwt.verify(
    credentials,
    JWT.accessTokenSecret,
    {
      algorithms: ['HS256']
    },
    (err, decoded) => {
      if (err) {
        return res.status(402).send('token expired')
      }
      if (!decoded) {
        return res.status(401).send('not login')
      }
      req.headers[HEADERS.USER_ID] = (decoded as any).user._id
      next()
    }
  )
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
