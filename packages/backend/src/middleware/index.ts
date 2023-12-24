import { Request, Response, NextFunction } from 'express'
import {
  verifyAccessToken,
  parseAuthorizationHeader
} from 'mzm-shared/src/auth/index'
import { HEADERS } from 'mzm-shared/src/auth/constants'
import { JWT } from '../config.js'
import { verifyInternalAccessToken } from '../lib/token.js'

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
      req.headers[HEADERS.GITHUB_USER_NAME] = decoded.user.githubUserName ?? ''
      req.headers[HEADERS.TWITTER_USER_NAME] =
        decoded.user.twitterUserName ?? ''
      next()
    })
    .catch(() => {
      return res.status(401).send('not login')
    })
}

export const checkInternalAccessToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const accessToken = parseAuthorizationHeader(req)
  if (!accessToken) {
    return res.status(401).send('no authorization header')
  }

  verifyInternalAccessToken(accessToken)
    .then(({ err }) => {
      if (err) {
        return res.status(401).send('not verify token')
      }
      next()
    })
    .catch(() => {
      return res.status(401).send('not login')
    })
}
