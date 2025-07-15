import type { Request } from 'express'
import type { Result } from 'mzm-shared/src/type'
import type { MongoClient } from 'mongodb'
import { z } from 'zod'
import { verifyAuthorizationCode as _verifyAuthorizationCode, generateAuthorizationCode } from './util.js'
import { logger } from '../logger.js'
import {
  saveCodeChallenge,
  getCodeChallenge,
  removeCodeChallenge
} from '../session.js'
import { ALLOW_REDIRECT_URIS } from '../../config.js'
import { collections } from '../db.js'

export { verifyCodeChallenge } from './util.js'

export const generateUniqAuthorizationCode = async (
  client: MongoClient
): Promise<Result<{ code: string }>> => {
  try {
    let generated = false
    let code = null
    for (let i = 0; i < 10; i++) {
      code = generateAuthorizationCode()
      // https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2
      // A maximum authorization code lifetime of 10 minutes is RECOMMENDED.
      const res = await collections(client).authorizationCode.findOne({
        code
      })
      if (!res) {
        generated = true
      }
    }
    if (!generated || !code) {
      return { success: false, error: { message: 'failed to generate code' } }
    }
    return { success: true, data: { code } }
  } catch (e) {
    logger.error({ label: 'generateUniqAuthorizationCode', error: e })
    return { success: false, error: { message: 'failed to generate code' } }
  }
}

export const saveAuthorizationCode = async (
  client: MongoClient,
  options: {
    code: string
    code_challenge: string
    userId: string
  }
) => {
  // https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2
  // A maximum authorization code lifetime of 10 minutes is RECOMMENDED.
  await collections(client).authorizationCode.insertOne({
    code: options.code,
    code_challenge: options.code_challenge,
    code_challenge_method: 'S256',
    userId: options.userId,
    createdAt: new Date()
  })

  return { code: options.code, code_challenge: options.code_challenge }
}

export const verifyAuthorizationCode = async (
  client: MongoClient,
  args: {
    code: string
    grant_type: string
    code_verifier: string
  }
): Promise<Result<{ userId: string }>> => {
  try {
    const { authorizationCode } = await collections(client)
    const val = await authorizationCode.findOne({
      code: args.code
    })
    if (!val) {
      return { success: false, error: { message: 'invalid code' } }
    }

    const res = await _verifyAuthorizationCode({
      code: args.code,
      grant_type: args.grant_type,
      code_verifier: args.code_verifier,
      code_challenge: val.code_challenge
    })
    if (res.success === false) {
      return res
    }

    await authorizationCode.deleteOne({
      code: args.code
    })

    return {
      success: true,
      data: { userId: val.userId }
    }
  } catch (e) {
    logger.info('[verifyAuthorizationCodeFromRedis]', e)
    return { success: false, error: { message: 'invalid code' } }
  }
}

const queryParser = z.object({
  code_challenge: z.string().min(1).trim(),
  code_challenge_method: z.literal('S256'),
  redirect_uri: z.string().min(1).trim()
})

export const saveParameterToSession = async (
  req: Request
): Promise<Result<z.infer<typeof queryParser>>> => {
  const query = queryParser.safeParse(req.query)
  if (query.success === false) {
    return {
      success: false,
      error: { status: 400, message: query.error.message }
    }
  }
  const { redirect_uri } = query.data
  if (!ALLOW_REDIRECT_URIS.includes(redirect_uri)) {
    return {
      success: false,
      error: { status: 400, message: 'not allowed redirect_uri' }
    }
  }

  const data = {
    code_challenge: query.data.code_challenge,
    code_challenge_method: query.data.code_challenge_method,
    redirect_uri
  }
  try {
    await saveCodeChallenge(req, data)
    return { success: true, data }
  } catch (e) {
    logger.info('[saveParameterToSession]', e)
    return {
      success: false,
      error: { message: 'fail to save parameter' }
    }
  }
}

export const getParametaerFromSession = async (
  req: Request
): Promise<
  Result<Exclude<Awaited<ReturnType<typeof getCodeChallenge>>, null>>
> => {
  const val = await getCodeChallenge(req)
  if (!val) {
    logger.error({
      label: 'getParametaerFromState',
      error: {
        message: 'invalid'
      }
    })
    return { success: false, error: { message: 'invalid session' } }
  }

  await removeCodeChallenge(req)

  return { success: true, data: val }
}
