import type { Request } from 'express'
import type { VerifyCallback } from 'passport-oauth2'
import type { WrapFn } from 'mzm-shared/lib/wrap'
import type { PassportRequest } from '../types.js'
import { BadRequest, Unauthorized } from 'mzm-shared/lib/errors'
import { ObjectId } from 'mongodb'
import {
  parseAuthorizationHeader,
  verifyAccessToken
} from 'mzm-shared/auth/index'
import { logger } from '../lib/logger.js'
import { collections, mongoClient, type User } from '../lib/db.js'
import { JWT } from '../config.js'

export const loginGithub = async (
  req: PassportRequest,
  githubId: string,
  githubUserName: string | undefined,
  cb: VerifyCallback
) => {
  try {
    const filter: { _id: ObjectId } | Pick<User, 'githubId'> = req.user
      ? { _id: new ObjectId(req.user._id) }
      : { githubId }

    const update: Pick<User, 'githubId' | 'githubUserName'> = {
      githubId,
      githubUserName
    }

    const db = await mongoClient()
    const updated = await collections(db).users.findOneAndUpdate(
      filter,
      { $set: update },
      {
        upsert: true
      }
    )
    logger.info(`[auth:update:github] id: ${githubId}, profile:`, {
      id: githubId,
      username: githubUserName
    })

    const user = updated.value
      ? updated.value
      : await collections(db).users.findOne(filter)

    cb(null, user ?? undefined)
  } catch (e) {
    logger.error('[auth:update:github] error:', githubId, githubUserName)
    cb(e as Error)
  }
}

export const removeGithub: WrapFn<Request, string> = async (req) => {
  const accessToken = parseAuthorizationHeader(req)
  if (!accessToken) {
    throw new BadRequest('no auth token')
  }
  const { err, decoded } = await verifyAccessToken(
    accessToken,
    JWT.accessTokenSecret,
    {
      issuer: JWT.issuer,
      audience: JWT.audience
    }
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

  if (!user.githubId) {
    throw new BadRequest('not linked')
  }

  if (!user.twitterId) {
    throw new BadRequest('can not remove github account')
  }

  await collections(db).users.updateOne(
    { _id },
    { $unset: { githubId: '', githubUserName: '' } }
  )

  return 'ok'
}
