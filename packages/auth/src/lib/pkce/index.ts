import type { Redis } from 'ioredis'
import type { Request } from 'express'
import type { Result } from 'mzm-shared/type'
import { z } from 'zod'
import { verifyAuthorizationCode, generateAuthorizationCode } from './util.js'
import { logger } from '../logger.js'
import {
  saveCodeChallenge,
  getCodeChallenge,
  removeCodeChallenge
} from '../session.js'
import { ALLOW_REDIRECT_URIS } from '../../config.js'

export { verifyCodeChallenge } from './util.js'

export const generateUniqAuthorizationCode = async (
  client: Redis
): Promise<Result<{ code: string }>> => {
  try {
    let generated = false
    let code = null
    for (let i = 0; i < 10; i++) {
      code = generateAuthorizationCode()
      // https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2
      // A maximum authorization code lifetime of 10 minutes is RECOMMENDED.
      const res = await client.set(
        `codegen:${code}`,
        code,
        'EX',
        6000 * 10,
        'NX'
      )
      if (res !== null) {
        generated = true
        break
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

export const removeCodeFromCodeGenerator = async (
  client: Redis,
  code: string
) => {
  const res = await client.del(`codegen:${code}`)
  return res
}

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
      code: options.code,
      code_challenge: options.code_challenge,
      code_challenge_method: 'S256',
      userId: options.userId
    }),
    'EX',
    60 * 10
  )

  return { code: options.code, code_challenge: options.code_challenge }
}

const getAuthorizationCode = async (client: Redis, code: string) => {
  const key = createAuthorizationCodeRedisKey(code)
  const val = await client.get(key)
  return val
}

const removeAuthorizationCode = async (client: Redis, code: string) => {
  const key = createAuthorizationCodeRedisKey(code)
  return await client.del(key)
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
): Promise<Result<{ userId: string }>> => {
  try {
    const val = await getAuthorizationCode(client, args.code)
    if (!val) {
      return { success: false, error: { message: 'invalid code' } }
    }

    const parsedAuthorizationCode = AuthorizationCode.safeParse(val)
    if (parsedAuthorizationCode.success === false) {
      return {
        success: false,
        error: { message: parsedAuthorizationCode.error.message }
      }
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

    await Promise.any([
      removeAuthorizationCode(client, args.code),
      removeCodeFromCodeGenerator(client, args.code)
    ])
    return {
      success: true,
      data: { userId: parsedAuthorizationCode.data.userId }
    }
  } catch (e) {
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
