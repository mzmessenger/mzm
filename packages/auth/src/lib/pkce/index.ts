import type { Redis } from 'ioredis'
import type { Request } from 'express'
import { z } from 'zod'
import { generateCodeChallenge, generateState } from './util.js'
import { logger } from '../logger.js'

export { generageAuthorizationCode, generateState } from './util.js'

const createAuthorizationCodeRedisKey = (code: string) => {
  return code
}

export const saveAuthorizationCode = async (
  client: Redis,
  options: {
    code: string
    code_challenge: string
  }
) => {
  // https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2
  // A maximum authorization code lifetime of 10 minutes is RECOMMENDED.
  await client.set(
    createAuthorizationCodeRedisKey(options.code),
    JSON.stringify({
      code_challenge: options.code_challenge,
      code_challenge_method: 'S256'
    }),
    'EX',
    60 * 10
  )

  return { code: options.code, code_challenge: options.code_challenge }
}

const AuthorizationCode = z.string().transform((str, ctx) => {
  const parser = z.object({
    code_challenge: z.string(),
    code_challenge_method: z.string()
  })

  try {
    return parser.parse(JSON.parse(str))
  } catch (e) {
    ctx.addIssue({ code: 'custom', message: 'invalid code json' })
    return z.NEVER
  }
})

export const verifyAuthorizationCode = async (
  client: Redis,
  options: {
    code: string
    grant_type: string
    code_verifier: string
  }
): Promise<
  | { success: true }
  | {
      success: false
      error: {
        message: string
      }
    }
> => {
  try {
    const key = createAuthorizationCodeRedisKey(options.code)
    const val = await client.get(key)
    if (!val) {
      return { success: false, error: { message: 'invalid code' } }
    }

    if (options.grant_type !== 'authorization_code') {
      return { success: false, error: { message: 'invalid grant type' } }
    }

    const parsedAuthorizationCode = AuthorizationCode.safeParse(val)
    if (!parsedAuthorizationCode.success) {
      return { success: false, error: { message: 'invalid code' } }
    }

    const code_challenge = await generateCodeChallenge(options.code_verifier)
    if (code_challenge !== parsedAuthorizationCode.data.code_challenge) {
      return { success: false, error: { message: 'invalid code_challenge' } }
    }

    await client.del(key)
    return { success: true }
  } catch (e) {
    return { success: false, error: { message: 'invalid code' } }
  }
}

const createStateRedisKey = (state: string) => {
  return `state:${state}`
}

export const saveParameterWithReuqest = async (
  client: Redis,
  req: Request
): Promise<
  | {
      success: true
      data: { state: string }
    }
  | {
      success: false
      error: { message: string }
    }
> => {
  const { code_challenge, code_challenge_method } = req.query
  if (!code_challenge || !code_challenge_method) {
    return { success: false, error: { message: 'invalid code_challenge' } }
  }
  const state = generateState()

  await client.set(
    createStateRedisKey(state),
    JSON.stringify({
      code_challenge,
      code_challenge_method
    }),
    'EX',
    60 * 5
  )
  return { success: true, data: { state } }
}

export const getParametaerFromState = async (
  client: Redis,
  state: string
): Promise<
  | {
      success: true
      data: { code_challenge: string; code_challenge_method: string }
    }
  | {
      success: false
      error: { message: string }
    }
> => {
  const keys = await client.keys('*')
  const key = createStateRedisKey(state)
  const val = await client.get(key)
  if (!val) {
    logger.error({
      label: 'getParametaerFromState',
      error: {
        message: 'invalid state',
        state,
        key
      }
    })
    return { success: false, error: { message: 'invalid state' } }
  }

  return { success: true, data: JSON.parse(val) }
}
