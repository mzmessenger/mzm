import type { Request } from 'express'
import type { SerializeUser, RequestUser } from '../types.js'
import type { WrapFn } from 'mzm-shared/lib/wrap'
import { BadRequest, Unauthorized } from 'mzm-shared/lib/errors'
import { ObjectId } from 'mongodb'
import {
  parseAuthorizationHeader,
  verifyAccessToken
} from 'mzm-shared/auth/index'
import { collections, mongoClient } from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { redis } from '../lib/redis.js'
import { JWT, REMOVE_STREAM } from '../config.js'

export const serializeUser = (
  user: Express.User,
  done: (err: unknown, id: string) => void
) => {
  const { _id } = user as SerializeUser
  done(null, _id.toHexString())
}

export const deserializeUser = (
  id: string,
  done: (err: unknown, user?: RequestUser) => void
) => {
  mongoClient()
    .then((client) => {
      return collections(client).users.findOne({ _id: new ObjectId(id) })
    })
    .then((user) => {
      done(null, user)
    })
    .catch((err) => done(err))
}

export const remove: WrapFn<Request, string> = async (req) => {
  const accessToken = parseAuthorizationHeader(req)
  if (!accessToken) {
    throw new Unauthorized('no auth token')
  }
  const { err, decoded } = await verifyAccessToken(
    accessToken,
    JWT.accessTokenSecret,
    {
      issuer: JWT.issuer,
      audience: JWT.audience
    }
  )
  if (err || !decoded.user._id) {
    throw new Unauthorized('unauthorized token')
  }
  logger.info('[remove]', req.user)
  if (!decoded.user._id) {
    throw new BadRequest('not auth')
  }
  await redis!.xadd(REMOVE_STREAM, '*', 'user', decoded.user._id)
  return 'ok'
}
