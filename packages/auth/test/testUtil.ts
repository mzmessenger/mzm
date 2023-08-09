/* eslint-disable no-console */
import('./types.js')

export const getTestDbName = (suffix: string) => {
  return `mzm-auth-${suffix}`
}

export const getTestMongoClient = async (context: typeof globalThis) => {
  return context.testMongoClient
}

export const getTestSessionRedisClient = async (context: typeof globalThis) => {
  return context.testSessionRedisClient
}

export const generateCodeVerifier = () => {
  const mask =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_~.'

  const randomValues = crypto.getRandomValues(new Uint8Array(43))

  let random = ''
  for (const value of randomValues) {
    random += mask[value % mask.length]
  }

  return random
}
