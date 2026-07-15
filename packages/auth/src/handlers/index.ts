import type { Request, Response } from 'express'
import type { SerializeUser, RequestUser } from '../types.js'
import { BadRequest, Unauthorized } from 'mzm-shared/src/lib/errors'
import { ObjectId, type MongoClient } from 'mongodb'
import { z } from 'zod'
import {
  parseAuthorizationHeader,
  verifyAccessToken
} from 'mzm-shared/src/auth/index'
import { collections } from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { JWT, ALLOW_REDIRECT_URIS } from '../config.js'
import { createRemoveUserOperation } from '../lib/outbox.js'

export function createSerializeUser() {
  return (user: Express.User, done: (err: unknown, id: string) => void) => {
    const { _id } = user as SerializeUser
    done(null, _id.toHexString())
  }
}

export function createDeserializeUserHandler(db: MongoClient) {
  return (id: string, done: (err: unknown, user?: RequestUser) => void) => {
    collections(db)
      .users.findOne({ _id: new ObjectId(id) })
      .then((user) => {
        done(null, user)
      })
      .catch((err) => done(err))
  }
}

export async function remove(req: Request, db: MongoClient) {
  const accessToken = parseAuthorizationHeader(req)
  if (!accessToken) {
    throw new Unauthorized('no auth token')
  }
  const { err, decoded } = await verifyAccessToken(
    accessToken,
    JWT.accessTokenSecret,
    JWT.signOptions
  )
  if (err || !decoded.user._id) {
    throw new Unauthorized('unauthorized token')
  }
  logger.info('[remove]', req.user)
  if (!decoded.user._id) {
    throw new BadRequest('not auth')
  }
  const key = req.headers['idempotency-key']
  if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new BadRequest('invalid idempotency key')
  return { operationId: await createRemoveUserOperation(db, decoded.user._id, key) }
}

const LogoutQuery = z.object({
  redirect_uri: z.string().trim().min(1).optional()
})

export function logout(req: Request, res: Response) {
  let redirect = ALLOW_REDIRECT_URIS[0]
  const query = LogoutQuery.safeParse(req.query)
  if (query.success && !!query.data.redirect_uri) {
    redirect = query.data.redirect_uri
  }

  req.logout(() => {
    res.redirect(redirect)
  })
}
