import { ObjectId } from 'mongodb'
import { Request, Response } from 'express'
import * as db from './lib/db'
import logger from './lib/logger'
import { redis } from './lib/redis'
import { REMOVE_STREAM } from './config'

type Serialize = db.User
type Deserialize = string
type RequestUser = db.User
type PassportRequest = Request & { user?: RequestUser }

export const auth = (req: PassportRequest, res: Response) => {
  if (req.user) {
    const id = req.user._id.toHexString()
    res.setHeader('X-USER-ID', id)
    res.setHeader(
      'X-TWITTER-USER-ID',
      req.user.twitterId ? req.user.twitterId : ''
    )
    res.setHeader(
      'X-TWITTER-USER-NAME',
      req.user.twitterUserName ? req.user.twitterUserName : ''
    )
    res.setHeader(
      'X-GITHUB-USER-ID',
      req.user.githubId ? req.user.githubId : ''
    )
    res.setHeader(
      'X-GITHUB-USER-NAME',
      req.user.githubUserName ? req.user.githubUserName : ''
    )
    logger.info('[auth] id:', id)
    return res.status(200).send('ok')
  } else if (req.headers['x-pass-through'] === 'yes') {
    res.setHeader('X-USER-ID', '')
    res.setHeader('X-TWITTER-USER-ID', '')
    res.setHeader('X-TWITTER-USER-NAME', '')
    res.setHeader('X-GITHUB-USER-ID', '')
    res.setHeader('X-GITHUB-USER-NAME', '')
    return res.status(200).send('ok')
  }
  res.status(401).send('not login')
}

export const serializeUser = (
  user: Serialize,
  // eslint-disable-next-line no-unused-vars
  done: (err, user: Deserialize) => void
) => {
  done(null, user._id.toHexString())
}

export const deserializeUser = (
  user: Deserialize,
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

export const loginTwitter = async (
  req: PassportRequest,
  twitterId: string,
  twitterUserName: string,
  // eslint-disable-next-line no-unused-vars
  cb: (error: any, user?: Serialize) => void
) => {
  try {
    const filter: Pick<db.User, '_id'> | Pick<db.User, 'twitterId'> = req.user
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

    if (updated.value) {
      cb(null, updated.value)
    } else {
      const user = await db.collections.users.findOne(filter)
      cb(null, user)
    }
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
  cb: (error: any, user?: Serialize) => void
) => {
  try {
    const filter: Pick<db.User, '_id'> | Pick<db.User, 'githubId'> = req.user
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
    if (updated.value) {
      cb(null, updated.value)
    } else {
      const user = await db.collections.users.findOne(filter)
      cb(null, user)
    }
  } catch (e) {
    logger.error('[auth:update:github] error:', githubId, githubUserName)
    cb(e)
  }
}

export const remoteTwitter = async (req: PassportRequest, res: Response) => {
  if (!req.user) {
    res.status(401).send('not auth')
  }

  const _id = new ObjectId(req.user._id)
  const user = await db.collections.users.findOne({ _id })

  if (!user.twitterId) {
    res.status(400).send('not linked')
  }

  if (!user.githubId) {
    res.status(400).send('can not remove')
  }

  await db.collections.users.updateOne(
    { _id },
    { $unset: { twitterId: '', twitterUserName: '' } }
  )

  res.status(200).send('ok')
}

export const remoteGithub = async (req: PassportRequest, res: Response) => {
  if (!req.user) {
    res.status(401).send('not auth')
  }

  const _id = new ObjectId(req.user._id)
  const user = await db.collections.users.findOne({ _id })

  if (!user.githubId) {
    res.status(400).send('not linked')
  }

  if (!user.githubId) {
    res.status(400).send('can not remove')
  }

  await db.collections.users.updateOne(
    { _id },
    { $unset: { githubId: '', githubUserName: '' } }
  )

  res.status(200).send('ok')
}

export const remove = async (req: PassportRequest, res: Response) => {
  logger.info('[remove]', req.user)
  if (req.user) {
    await redis.xadd(REMOVE_STREAM, '*', 'user', req.user._id.toHexString())
    return res.status(200).send('ok')
  }
  return res.status(401).send('not auth')
}
