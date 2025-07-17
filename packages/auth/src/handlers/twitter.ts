import type { Request } from 'express'
import type { VerifyCallback } from 'passport-oauth2'
import type { PassportRequest } from '../types.js'
import { BadRequest, Unauthorized } from 'mzm-shared/src/lib/errors'
import { ObjectId } from 'mongodb'
import {
  parseAuthorizationHeader,
  verifyAccessToken
} from 'mzm-shared/src/auth/index'
import { logger } from '../lib/logger.js'
import { collections, mongoClient, type User } from '../lib/db.js'
import { JWT } from '../config.js'

export const loginTwitter = async (
  req: PassportRequest,
  twitterId: string,
  twitterUserName: string,
  cb: VerifyCallback
) => {
  try {
    const filter: { _id: ObjectId } | Pick<User, 'twitterId'> = req.user
      ? { _id: new ObjectId(req.user._id) }
      : { twitterId }

    const update: Pick<User, 'twitterId' | 'twitterUserName'> = {
      twitterId,
      twitterUserName
    }

    const db = await mongoClient()
    const updated = await collections(db).users.findOneAndUpdate(
      filter,
      { $set: update },
      {
        upsert: true
      }
    )

    logger.info(`[auth:update:twitter] id: ${twitterId}, profile:`, {
      id: twitterId,
      username: twitterUserName
    })

    const user = updated ? updated : await collections(db).users.findOne(filter)

    cb(null, user ?? undefined)
  } catch (e) {
    logger.error('[auth:update:twitter] error:', twitterId, twitterUserName)
    cb(e as Error)
  }
}

export const removeTwitter= async (req: Request) => {
  const accessToken = parseAuthorizationHeader(req)
  if (!accessToken) {
    throw new BadRequest('no auth token')
  }
  const { err, decoded } = await verifyAccessToken(
    accessToken,
    JWT.accessTokenSecret,
    JWT.signOptions
  )

  if (err || !decoded.user) {
    throw new Unauthorized('unauthorized token')
  }

  const _id = new ObjectId(decoded.user._id)
  const db = await mongoClient()
  const user = await collections(db).users.findOne({ _id })

  if (!user) {
    throw new BadRequest('not exists')
  }

  if (!user.twitterId) {
    throw new BadRequest('not linked')
  }

  if (!user.githubId) {
    throw new BadRequest('can not remove twitter account')
  }

  await collections(db).users.updateOne(
    { _id },
    { $unset: { twitterId: '', twitterUserName: '' } }
  )

  return 'ok'
}
