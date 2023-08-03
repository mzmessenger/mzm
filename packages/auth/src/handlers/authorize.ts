import type { NextFunction, Request, Response } from 'express'
import type { PassportRequest } from './types.js'
import type { AUTH_API_RESPONSE } from 'mzm-shared/type/api'
import { randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { z } from 'zod'
import { logger } from '../lib/logger.js'
import * as db from '../lib/db.js'
import { sessionRedis } from '../lib/redis.js'
import { createAccessToken } from '../lib/token.js'
import {
  generageAuthorizationCode,
  saveAuthorizationCode
} from '../lib/pkce/index.js'
import { verifyAuthorizationCodeFromRedis } from '../lib/pkce/index.js'
import { authorizeTemplate } from '../views/authorize.js'
import { CLIENT_URL_BASE } from '../config.js'

export const accessToken = async (req: Request, res: Response) => {
  type ResponseType = AUTH_API_RESPONSE['/auth/token']['POST']['body']

  try {
    logger.info('[accessToken]', 'start')

    const verify = await verifyAuthorizationCodeFromRedis(sessionRedis, {
      code: req.body.code,
      grant_type: req.body.grant_type,
      code_verifier: req.body.code_verifier
    })

    if (verify.success === false) {
      return res.status(401).send(verify.error.message)
    }

    const user = await db.collections.users.findOne({
      _id: new ObjectId(verify.data.userId)
    })

    const accessToken = await createAccessToken({
      _id: user._id.toHexString(),
      twitterId: user.twitterId,
      twitterUserName: user.twitterUserName,
      githubId: user.githubId,
      githubUserName: user.githubUserName
    })
    logger.info('[accessToken]', 'created accessToken', {
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
    logger.info('[accessToken]', 'error', e)
    return res.status(401).send('invalid code')
  }
}

export type AuthorizationResponse = Response<unknown, { nonce: string }>

export const createNonceMiddleware = (
  req: Request,
  res: AuthorizationResponse,
  next: NextFunction
) => {
  const nonce = randomBytes(16).toString('hex')
  res.locals.nonce = nonce
  next()
}

const AuthorizationQuery = z.object({
  code_challenge: z.string(),
  state: z.string().optional()
})

export const authorize = async (
  req: PassportRequest,
  res: AuthorizationResponse
) => {
  try {
    if (!req.user) {
      return res.status(401).send('unauthorized')
    }
    const query = AuthorizationQuery.safeParse(req.query)
    if (query.success === false) {
      logger.error({ label: 'authorize', error: query.error })
      return res.status(400).send('invalid query')
    }

    const code = generageAuthorizationCode()
    const code_challenge = encodeURIComponent(query.data.code_challenge)

    await saveAuthorizationCode(sessionRedis, {
      code,
      code_challenge,
      userId: req.user._id.toHexString()
    })

    const state = encodeURIComponent(query.data.state)
    const html = authorizeTemplate({
      targetOrigin: CLIENT_URL_BASE,
      code,
      state,
      nonce: res.locals.nonce
    })
    res.status(200).send(html)
  } catch (e) {
    res.status(500).send('internal server error')
  }
}
