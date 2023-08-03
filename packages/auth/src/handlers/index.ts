import type { Request, Response } from 'express'
import type { AUTH_API_RESPONSE } from 'mzm-shared/type/api'
import type { SerializeUser, RequestUser, PassportRequest } from './types.js'
import { ObjectId } from 'mongodb'
import {
  parseAuthorizationHeader,
  verifyAccessToken
} from 'mzm-shared/auth/index'
import { COOKIES } from 'mzm-shared/auth/constants'
import * as db from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { redis } from '../lib/redis.js'
import {
  verifyRefreshToken,
  createAccessToken,
  type RefeshToken
} from '../lib/token.js'
import { JWT, REMOVE_STREAM } from '../config.js'

export { oauthCallback, oauth } from './oauth.js'
export { loginGithub, removeGithub } from './github.js'
export { loginTwitter, removeTwitter } from './twitter.js'
export {
  authorize,
  accessToken,
  createNonceMiddleware,
  type AuthorizationResponse
} from './authorize.js'

export const serializeUser = (
  user: SerializeUser,
  // eslint-disable-next-line no-unused-vars
  done: (err, id: string) => void
) => {
  done(null, user._id.toHexString())
}

export const deserializeUser = (
  id: string,
  // eslint-disable-next-line no-unused-vars
  done: (err, user?: RequestUser) => void
) => {
  db.collections.users
    .findOne({ _id: new ObjectId(id) })
    .then((user) => {
      done(null, user)
    })
    .catch((err) => done(err))
}

// @todo remove
export const refreshAccessToken = async (req: Request, res: Response) => {
  type ResponseType = AUTH_API_RESPONSE['/auth/token/refresh']['POST']['body']
  try {
    logger.info('[refreshAccessToken]', 'start')
    const decode = await verifyRefreshToken(req.cookies[COOKIES.REFRESH_TOKEN])

    const user = await db.collections.users.findOne({
      _id: new ObjectId((decode as RefeshToken).user._id)
    })
    logger.info('[refreshAccessToken]', 'find user', {
      user: user._id.toHexString()
    })

    const accessToken = await createAccessToken({
      _id: user._id.toHexString(),
      twitterId: user.twitterId,
      twitterUserName: user.twitterUserName,
      githubId: user.githubId,
      githubUserName: user.githubUserName
    })
    logger.info('[refreshAccessToken]', 'created accessToken', {
      user: user._id.toHexString()
    })

    const response: ResponseType[200] = {
      accessToken,
      user: {
        _id: user._id.toHexString(),
        twitterId: user.twitterId,
        twitterUserName: user.twitterUserName,
        githubId: user.githubId,
        githubUserName: user.githubUserName
      }
    }
    res.status(200).json(response)
  } catch (e) {
    logger.info('[refreshAccessToken]', 'error', e)
    const response: ResponseType[400] = 'not login'
    return res.status(401).send(response)
  }
}

export const remove = async (req: PassportRequest, res: Response) => {
  const accessToken = parseAuthorizationHeader(req)
  const { err, decoded } = await verifyAccessToken(
    accessToken,
    JWT.accessTokenSecret,
    {
      issuer: JWT.issuer,
      audience: JWT.audience
    }
  )
  if (err || !decoded.user._id) {
    return res.status(401).send('not auth token')
  }
  logger.info('[remove]', req.user)
  if (decoded.user._id) {
    await redis.xadd(REMOVE_STREAM, '*', 'user', req.user._id.toHexString())
    return res.status(200).send('ok')
  }
  return res.status(401).send('not auth')
}
