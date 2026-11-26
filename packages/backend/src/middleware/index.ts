import { Request, Response, NextFunction, type RequestHandler } from 'express'
import { createHash, timingSafeEqual } from 'node:crypto'
import {
  verifyAccessToken,
  parseAuthorizationHeader
} from 'mzm-shared/src/auth/index'
import { HEADERS } from 'mzm-shared/src/auth/constants'
import { JWT, QUEUE_CALLBACK_SECRET } from '../config.js'
import { logger } from '../lib/logger.js'
import { verifyInternalAccessToken } from '../lib/token.js'

function constantTimeEqual(a: string, b: string) {
  // Hashing first makes the comparison length-independent and fixed-cost.
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest()
  )
}

export const createGatewayOriginCheck = (secret: string): RequestHandler => {
  return (req, res, next) => {
    const authorization = req.headers['x-mzm-gateway-authorization']
    // A rejection must not describe the secret or its configuration state:
    // response headers and body stay identical for every failure reason.
    if (
      secret === '' ||
      typeof authorization !== 'string' ||
      !constantTimeEqual(authorization, `Bearer ${secret}`)
    ) {
      logger.warn({ event: 'gateway_origin_unauthorized' })
      res.status(401).send('unauthorized')
      return
    }
    next()
  }
}

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

export const checkQueueSecret = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authorization = req.headers.authorization
  if (
    !QUEUE_CALLBACK_SECRET ||
    typeof authorization !== 'string' ||
    !constantTimeEqual(authorization, `Bearer ${QUEUE_CALLBACK_SECRET}`)
  ) {
    res.status(401).send('unauthorized')
    return
  }
  next()
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
