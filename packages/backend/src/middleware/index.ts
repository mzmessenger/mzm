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
    res.status(401).send('no authorization header')
    return
  }

  verifyAccessToken(accessToken, JWT.accessTokenSecret, JWT.verifyOptions)
    .then(({ err, decoded }) => {
      if (err) {
        res.status(401).send('not verify token')
        return
      }
      if (!decoded) {
        res.status(401).send('not login')
        return
      }
      req.headers[HEADERS.USER_ID] = decoded.user._id
      req.headers[HEADERS.GITHUB_USER_NAME] = decoded.user.githubUserName ?? ''
      req.headers[HEADERS.TWITTER_USER_NAME] =
        decoded.user.twitterUserName ?? ''
      next()
    })
    .catch(() => {
      res.status(401).send('not login')
      return
    })
}

export const checkInternalAccessToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const accessToken = parseAuthorizationHeader(req)
  if (!accessToken) {
    res.status(401).send('no authorization header')
    return
  }

  verifyInternalAccessToken(accessToken)
    .then(({ err }) => {
      if (err) {
        res.status(401).send('not verify token')
        return
      }
      next()
    })
    .catch(() => {
      res.status(401).send('not login')
    })
}
