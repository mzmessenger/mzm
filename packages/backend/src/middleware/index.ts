import { Request, Response, NextFunction } from 'express'
import {
  verifyAccessToken,
  parseAuthorizationHeader
} from 'mzm-shared/auth/index'
import { HEADERS } from 'mzm-shared/auth/constants'
import { JWT } from '../config.js'
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

  verifyAccessToken(accessToken, JWT.accessTokenSecret, {
    issuer: JWT.issuer,
    audience: JWT.audience
  })
    .then(({ err, decoded }) => {
      if (err) {
        return res.status(401).send('not verify token')
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
