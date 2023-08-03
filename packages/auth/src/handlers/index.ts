import type { Response } from 'express'
import type { SerializeUser, RequestUser, PassportRequest } from '../types.js'
import { ObjectId } from 'mongodb'
import {
  parseAuthorizationHeader,
  verifyAccessToken
} from 'mzm-shared/auth/index'
import * as db from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { redis } from '../lib/redis.js'
import { JWT, REMOVE_STREAM } from '../config.js'

export const serializeUser = (
  user: Express.User,
  done: (err, id: string) => void
) => {
  const { _id } = user as SerializeUser
  done(null, _id.toHexString())
}

export const deserializeUser = (
  id: string,
  done: (err, user?: RequestUser) => void
) => {
  db.collections()
    .users.findOne({ _id: new ObjectId(id) })
    .then((user) => {
      done(null, user)
    })
    .catch((err) => done(err))
}

export const remove = async (req: PassportRequest, res: Response) => {
  const accessToken = parseAuthorizationHeader(req)
  if (!accessToken) {
    return res.status(401).send('not auth token')
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
    return res.status(401).send('not auth token')
  }
  logger.info('[remove]', req.user)
  if (decoded.user._id) {
    await redis!.xadd(REMOVE_STREAM, '*', 'user', decoded.user._id)
    return res.status(200).send('ok')
  }
  return res.status(401).send('not auth')
}
