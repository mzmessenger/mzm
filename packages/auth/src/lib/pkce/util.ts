import type { Result } from 'mzm-shared/type'
import { createHash, randomUUID, getRandomValues } from 'node:crypto'

export const generateState = () => {
  const mask =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_~.'
  const randomValues = getRandomValues(new Uint8Array(32))
  let random = ''
  for (const value of randomValues) {
    random += mask[value % mask.length]
  }

  return urlsafeBase64Encode(random)
}

const urlsafeBase64Encode = (str: string) => {
  const hash = createHash('sha256')
    .update(str)
    .digest('base64')
    .replace(/\//g, '_')
    .replace(/\+/g, '-')
    .replace(/=/g, '')

  return hash
}

export const generageAuthorizationCode = () => {
  return urlsafeBase64Encode(randomUUID())
}

export const generateCodeChallenge = (str: string) => {
  const hash = urlsafeBase64Encode(str)

  return hash
}

export const verifyCodeChallenge = (options: {
  code_verifier: string
  code_challenge: string
}) => {
  const generated = generateCodeChallenge(options.code_verifier)
  return options.code_challenge === generated
}

export const verifyAuthorizationCode = async (options: {
  code: string
  grant_type: string
  code_verifier: string
  code_challenge: string
}): Promise<Result<unknown>> => {
  try {
    if (!options.code) {
      return { success: false, error: { message: 'empty code' } }
    }
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

    return { success: true, data: undefined }
  } catch (e) {
    return { success: false, error: { message: 'invalid code' } }
  }
}
