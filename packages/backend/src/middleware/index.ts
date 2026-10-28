import { Request, Response, NextFunction, type RequestHandler } from 'express'
import { createHash } from 'node:crypto'
import {
  verifyAccessToken,
  parseAuthorizationHeader
} from 'mzm-shared/src/auth/index'
import { HEADERS } from 'mzm-shared/src/auth/constants'
import { JWT, QUEUE_CALLBACK_SECRET } from '../config.js'
import { logger } from '../lib/logger.js'
import { verifyInternalAccessToken } from '../lib/token.js'

function secretFingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

export const createGatewayOriginCheck = (secret: string): RequestHandler => {
  return (req, res, next) => {
    const authorization = req.headers['x-mzm-gateway-authorization']
    const hasAuthorization = typeof authorization === 'string'
    const secretConfigured = secret !== ''
    const authorized = secretConfigured && authorization === `Bearer ${secret}`

    if (!authorized) {
      logger.warn({
        event: 'gateway_origin_unauthorized',
        hasAuthorization,
        secretConfigured
      })
      res.set('x-mzm-gateway-secret-expected', secretFingerprint(secret))
      if (hasAuthorization) {
        res.set(
          'x-mzm-gateway-secret-received',
          secretFingerprint(authorization.replace(/^Bearer /, ''))
        )
      }
      res
        .status(401)
        .send(
          !secretConfigured
            ? 'gateway origin secret is not configured'
            : hasAuthorization
              ? 'invalid gateway origin authorization'
              : 'missing gateway origin authorization'
        )
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
  if (
    !QUEUE_CALLBACK_SECRET ||
    req.headers.authorization !== `Bearer ${QUEUE_CALLBACK_SECRET}`
  ) {
    res.status(401).send('invalid queue secret')
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
