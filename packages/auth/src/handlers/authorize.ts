import type { Request } from 'express'
import type { AuthAPI } from 'mzm-shared/src/api/universal'
import type { WrapFn } from 'mzm-shared/src/lib/wrap'
import type { PassportRequest } from '../types.js'
import type { NonceResponse } from '../middleware/index.js'
import type { Redis } from 'ioredis'
import {
  BadRequest,
  Unauthorized,
  InternalServerError,
  isHttpError
} from 'mzm-shared/src/lib/errors'
import { ObjectId } from 'mongodb'
import { z } from 'zod'
import { logger } from '../lib/logger.js'
import { mongoClient, collections } from '../lib/db.js'
import { sessionRedis } from '../lib/redis.js'
import { createTokens, verifyRefreshToken } from '../lib/token.js'
import {
  generateUniqAuthorizationCode,
  saveAuthorizationCode
} from '../lib/pkce/index.js'
import { verifyAuthorizationCodeFromRedis } from '../lib/pkce/index.js'
import {
  authorizeTemplate,
  authorizeErrorTemplate
} from '../views/authorize.js'
import { ALLOW_REDIRECT_URIS } from '../config.js'

const TokenBody = z.union([
  z.object({
    code: z.string(),
    grant_type: z.literal('authorization_code'),
    code_verifier: z.string()
  }),
  z.object({
    grant_type: z.literal('refresh_token'),
    refresh_token: z.string()
  })
])

export const token: WrapFn<
  Request,
  AuthAPI['/auth/token']['POST']['response'][200]['body']
> = async (req) => {
  logger.info({
    label: 'accessToken',
    message: 'start'
  })
  const body = TokenBody.safeParse(req.body)
  if (body.success === false) {
    throw new BadRequest({ message: body.error.message })
  }

  let userId: string | null = null
  if (body.data.grant_type === 'authorization_code') {
    const client = await sessionRedis()
    const verify = await verifyAuthorizationCodeFromRedis(client, {
      code: body.data.code,
      grant_type: body.data.grant_type,
      code_verifier: body.data.code_verifier
    })
    if (verify.success === false) {
      throw new Unauthorized({ message: verify.error.message })
    }
    userId = verify.data.userId
  } else if (body.data.grant_type === 'refresh_token') {
    const { err, decoded } = await verifyRefreshToken(body.data.refresh_token)
    if (err) {
      throw new Unauthorized({ message: 'invalid token' })
    }
    userId = decoded?.user?._id ?? null
  }

  if (!userId) {
    throw new BadRequest({ message: 'invalid grant_type' })
  }
  const user = await collections(await mongoClient()).users.findOne({
    _id: new ObjectId(userId)
  })

  if (!user) {
    throw new BadRequest({ message: 'invalid user' })
  }

  const { accessToken, refreshToken } = await createTokens({
    _id: user._id.toHexString(),
    twitterId: user.twitterId,
    twitterUserName: user.twitterUserName,
    githubId: user.githubId,
    githubUserName: user.githubUserName
  })
  logger.info({
    label: 'accessToken',
    message: 'createTokens',
    user: user._id.toHexString()
  })

  const response = {
    accessToken,
    refreshToken,
    user: {
      _id: user._id.toHexString(),
      twitterId: user.twitterId ?? null,
      twitterUserName: user.twitterUserName ?? null,
      githubId: user.githubId ?? null,
      githubUserName: user.githubUserName ?? null
    }
  }
  return response
}

const AuthorizationQuery = z.object({
  code_challenge: z.string().min(1),
  redirect_uri: z.string().min(1),
  state: z.string().optional()
})

export const createAuthorize = (
  res: NonceResponse,
  client: Redis
): WrapFn<Request, string> => {
  const nonce = res.locals.nonce
  return async (req) => {
    try {
      const { user } = req as PassportRequest
      if (!user) {
        throw new Unauthorized('unauthorized')
      }
      const query = AuthorizationQuery.safeParse(req.query)
      if (query.success === false) {
        logger.error({ label: 'authorize', error: query.error })
        throw new BadRequest('invalid query')
      }

      if (!ALLOW_REDIRECT_URIS.includes(query.data.redirect_uri)) {
        throw new BadRequest('invalid host')
      }

      const generateCode = await generateUniqAuthorizationCode(client)
      if (generateCode.success === false) {
        throw new InternalServerError('code generate error')
      }
      const code_challenge = encodeURIComponent(query.data.code_challenge)

      const { code } = generateCode.data

      await saveAuthorizationCode(client, {
        code,
        code_challenge,
        userId: user._id.toHexString()
      })

      const state = encodeURIComponent(query.data.state ?? '')
      const html = authorizeTemplate({
        targetOrigin: new URL(query.data.redirect_uri).origin,
        code,
        state,
        nonce
      })
      return html
    } catch (e) {
      const status = isHttpError(e) ? e.status : 500
      const html = authorizeErrorTemplate({ nonce, status })
      return html
    }
  }
}
