import type { PassportRequest, SerializeUser } from './types.js'
import type { Response } from 'express'
import { ObjectId } from 'mongodb'
import {
  parseAuthorizationHeader,
  verifyAccessToken
} from 'mzm-shared/auth/index'
import { logger } from '../lib/logger.js'
import * as db from '../lib/db.js'
import { JWT } from '../config.js'

export const loginGithub = async (
  req: PassportRequest,
  githubId: string,
  githubUserName: string,
  // eslint-disable-next-line no-unused-vars
  cb: (error: unknown, user?: SerializeUser) => void
) => {
  try {
    const filter: { _id: ObjectId } | Pick<db.User, 'githubId'> = req.user
      ? { _id: new ObjectId(req.user._id) }
      : { githubId }

    const update: Pick<db.User, 'githubId' | 'githubUserName'> = {
      githubId,
      githubUserName
    }

    const updated = await db.collections.users.findOneAndUpdate(
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
      : await db.collections.users.findOne(filter)

    cb(null, user)
  } catch (e) {
    logger.error('[auth:update:github] error:', githubId, githubUserName)
    cb(e)
  }
}

export const removeGithub = async (req: PassportRequest, res: Response) => {
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

  const _id = new ObjectId(req.user._id)
  const user = await db.collections.users.findOne({ _id })

  if (!user.githubId) {
    return res.status(400).send('not linked')
  }

  if (!user.githubId) {
    return res.status(400).send('can not remove')
  }

  await db.collections.users.updateOne(
    { _id },
    { $unset: { githubId: '', githubUserName: '' } }
  )

  res.status(200).send('ok')
}
