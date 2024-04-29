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
