import type { Redis } from 'ioredis'
import type { Request } from 'express'
import { z } from 'zod'
import { generateState, verifyCodeChallenge } from './util.js'
import { logger } from '../logger.js'

export {
  generageAuthorizationCode,
  generateState,
  verifyCodeChallenge
} from './util.js'

const createAuthorizationCodeRedisKey = (code: string) => {
  return `code:${code}`
}

export const saveAuthorizationCode = async (
  client: Redis,
  options: {
    code: string
    code_challenge: string
    userId: string
  }
) => {
  // https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2
  // A maximum authorization code lifetime of 10 minutes is RECOMMENDED.
  await client.set(
    createAuthorizationCodeRedisKey(options.code),
    JSON.stringify({
      code_challenge: options.code_challenge,
      code_challenge_method: 'S256',
      userId: options.userId
    }),
    'EX',
    60 * 10
  )

  return { code: options.code, code_challenge: options.code_challenge }
}

const AuthorizationCode = z.string().transform((str, ctx) => {
  const parser = z.object({
    code_challenge: z.string(),
    code_challenge_method: z.string(),
    userId: z.string()
  })

  try {
    return parser.parse(JSON.parse(str))
  } catch (e) {
    ctx.addIssue({ code: 'custom', message: 'invalid code json' })
    return z.NEVER
  }
})

export const verifyAuthorizationCodeFromRedis = async (
  client: Redis,
  args: {
    code: string
    grant_type: string
    code_verifier: string
  }
): Promise<
  | { success: true; data: { userId: string } }
  | {
      success: false
      error: {
        message: string
      }
    }
> => {
  try {
    const key = createAuthorizationCodeRedisKey(args.code)
    const val = await client.get(key)
    if (!val) {
      return { success: false, error: { message: 'invalid code' } }
    }

    const parsedAuthorizationCode = AuthorizationCode.safeParse(val)
    if (parsedAuthorizationCode.success === false) {
      return { success: false, error: { message: 'invalid code' } }
    }

    const res = await verifyAuthorizationCode({
      code: args.code,
      grant_type: args.grant_type,
      code_verifier: args.code_verifier,
      code_challenge: parsedAuthorizationCode.data.code_challenge
    })
    if (res.success === false) {
      return res
    }

    await client.del(key)
    return {
      success: true,
      data: { userId: parsedAuthorizationCode.data.userId }
    }
  } catch (e) {
    return { success: false, error: { message: 'invalid code' } }
  }
}

const verifyAuthorizationCode = async (options: {
  code: string
  grant_type: string
  code_verifier: string
  code_challenge: string
}): Promise<
  | { success: true }
  | {
      success: false
      error: {
        message: string
      }
    }
> => {
  try {
    if (options.grant_type !== 'authorization_code') {
      return { success: false, error: { message: 'invalid grant type' } }
    }

    const success = verifyCodeChallenge({
      code_verifier: options.code_verifier,
      code_challenge: options.code_challenge
    })
    if (!success) {
      return { success: false, error: { message: 'invalid code_challenge' } }
    }

    return { success: true }
  } catch (e) {
    return { success: false, error: { message: 'invalid code' } }
  }
}

const createStateRedisKey = (state: string) => {
  return `state:${state}`
}

const queryParser = z.object({
  code_challenge: z.string().min(1),
  code_challenge_method: z.literal('S256')
})

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
  const query = queryParser.safeParse(req.query)
  if (query.success === false) {
    return { success: false, error: { message: query.error.message } }
  }
  const state = generateState()

  await client.set(
    createStateRedisKey(state),
    JSON.stringify({
      code_challenge: query.data.code_challenge,
      code_challenge_method: query.data.code_challenge_method
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
