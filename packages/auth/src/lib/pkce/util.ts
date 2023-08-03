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
