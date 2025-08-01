import('./types.js')
import { afterAll, beforeAll } from 'vitest'
import { MongoClient } from 'mongodb'
import { getTestDbName, getTestDbParams } from './testUtil.js'

beforeAll(async () => {
  const dbName = getTestDbName(process.env.VITEST_POOL_ID!)
  const { userName, userPassword, host, port } = getTestDbParams()

  const testMongoUri = `mongodb://${userName}:${userPassword}@${host}:${port}/${dbName}`
  globalThis.testMongoClient = await MongoClient.connect(testMongoUri)
})

afterAll(async () => {
  await globalThis.testMongoClient?.db().dropDatabase()
  await Promise.all([globalThis.testMongoClient?.close()])
})
