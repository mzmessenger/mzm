import { getTestMongoClient } from './testUtil.js'

export const mockDb = async (actual: typeof import('../src/lib/db.js')) => {
  const client = await getTestMongoClient()
  return {
    ...actual,
    mongoClient: () => client
  }
}
