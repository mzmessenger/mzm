import { Request, Response, NextFunction } from 'express'
import { HEADERS, requestAuthServer } from 'mzm-shared/auth'
import { AUTH_SERVER } from '../config'
import * as HttpErrors from '../lib/errors'
import { logger } from '../lib/logger'

const allHttpErrors = Object.keys(HttpErrors).map((err) => HttpErrors[err])

export const errorHandler = (err, _req, res: Response, _next) => {
  if (allHttpErrors.some((type) => err instanceof type)) {
    return res.status(err.status).send(err.toResponse())
  }
  res.status(500).send('Internal Server Error')
  logger.error('[Internal Server Error]', err)
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
