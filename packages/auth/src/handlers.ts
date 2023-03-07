import type { Request, Response } from 'express'
import type { AUTH_API_RESPONSE } from 'mzm-shared/type/api'
import { ObjectId, WithId } from 'mongodb'
import {
  parseAuthorizationHeader,
  verifyAccessToken
} from 'mzm-shared/auth/index'
import { COOKIES } from 'mzm-shared/auth/constants'
import * as db from './lib/db.js'
import { logger } from './lib/logger.js'
import { redis } from './lib/redis.js'
import {
  verifyRefreshToken,
  createAccessToken,
  createTokens,
  type RefeshToken
} from './lib/token.js'
import { JWT, REMOVE_STREAM } from './config.js'

export type SerializeUser = WithId<db.User> &
  Request['user'] & {
    accessToken: string
    refreshToken: string
  }
type SerializedUser = string
type RequestUser = WithId<db.User>
type PassportRequest = Request & { user?: RequestUser }

export const serializeUser = (
  user: SerializeUser,
  // eslint-disable-next-line no-unused-vars
  done: (err, user: SerializedUser) => void
) => {
  done(null, user._id.toHexString())
}

export const deserializeUser = (
  user: SerializedUser,
  // eslint-disable-next-line no-unused-vars
  done: (err, user?: RequestUser) => void
) => {
  db.collections.users
    .findOne({ _id: new ObjectId(user) })
    .then((user) => {
      done(null, user)
    })
    .catch((err) => done(err))
}

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

    const { accessToken, refreshToken } = await createTokens({
      _id: user._id.toHexString(),
      twitterId: user.twitterId,
      twitterUserName: user.twitterUserName,
      githubId: githubId,
      githubUserName: githubUserName
    })

    cb(null, { ...user, accessToken, refreshToken })
  } catch (e) {
    logger.error('[auth:update:github] error:', githubId, githubUserName)
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

  const newAccessToken = await createAccessToken({
    _id: user._id.toHexString(),
    twitterId: user.twitterId,
    twitterUserName: user.twitterUserName,
    githubId: '',
    githubUserName: ''
  })

  res.cookie(COOKIES.ACCESS_TOKEN, newAccessToken).status(200).send('ok')
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
