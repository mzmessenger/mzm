import('./types.js')

export function getTestDbName(suffix: string) {
  return `mzm-auth-${suffix}`
}

export function getTestDbParams() {
  const TEST_MONGODB_HOST = process.env.TEST_MONGODB_HOST ?? 'localhost'
  const TEST_MONGODB_PORT = process.env.TEST_MONGODB_PORT ?? '27018'

  const userName = 'mzm-auth-test'
  const userPassword = 'mzm-auth-test-password'

  return {
    userName,
    userPassword,
    host: TEST_MONGODB_HOST,
    port: TEST_MONGODB_PORT
  }
}

export async function getTestMongoClient(context: typeof globalThis) {
  return context.testMongoClient
}

export async function getTestSessionRedisClient(context: typeof globalThis) {
  return context.testSessionRedisClient
}
