import type { PassportRequest, SerializeUser } from './types.js'
import type { Response } from 'express'
import { ObjectId } from 'mongodb'
import {
  parseAuthorizationHeader,
  verifyAccessToken
} from 'mzm-shared/auth/index'
import { COOKIES } from 'mzm-shared/auth/constants'
import { logger } from '../lib/logger.js'
import * as db from '../lib/db.js'
import { createTokens, createAccessToken } from '../lib/token.js'
import { JWT } from '../config.js'

export const loginTwitter = async (
  req: PassportRequest,
  twitterId: string,
  twitterUserName: string,
  // eslint-disable-next-line no-unused-vars
  cb: (error: unknown, user?: SerializeUser) => void
) => {
  try {
    const filter: { _id: ObjectId } | Pick<db.User, 'twitterId'> = req.user
      ? { _id: new ObjectId(req.user._id) }
      : { twitterId }

    const update: Pick<db.User, 'twitterId' | 'twitterUserName'> = {
      twitterId,
      twitterUserName
    }

    const updated = await db.collections.users.findOneAndUpdate(
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

    const user = updated.value
      ? updated.value
      : await db.collections.users.findOne(filter)

    const { accessToken, refreshToken } = await createTokens({
      _id: user._id.toHexString(),
      twitterId: twitterId,
      twitterUserName: twitterUserName,
      githubId: user.githubId,
      githubUserName: user.githubUserName
    })

    cb(null, { ...user, accessToken, refreshToken })
  } catch (e) {
    logger.error('[auth:update:twitter] error:', twitterId, twitterUserName)
    cb(e)
  }
}

export const removeTwitter = async (req: PassportRequest, res: Response) => {
  const accessToken = parseAuthorizationHeader(req)
  const { err, decoded } = await verifyAccessToken(
    accessToken,
    JWT.accessTokenSecret,
    {
      issuer: JWT.issuer,
      audience: JWT.audience
    }
  )

  if (err || !decoded.user) {
    return res.status(401).send('not auth token')
  }

  const _id = new ObjectId(decoded.user._id)
  const user = await db.collections.users.findOne({ _id })

  if (!user.twitterId) {
    res.status(400).send('not linked')
    return
  }

  if (!user.githubId) {
    res.status(400).send('can not remove')
    return
  }

  await db.collections.users.updateOne(
    { _id },
    { $unset: { twitterId: '', twitterUserName: '' } }
  )

  const newAccessToken = await createAccessToken({
    _id: user._id.toHexString(),
    twitterId: '',
    twitterUserName: '',
    githubId: user.githubId,
    githubUserName: user.githubUserName
  })

  res.cookie(COOKIES.ACCESS_TOKEN, newAccessToken).status(200).send('ok')
}
