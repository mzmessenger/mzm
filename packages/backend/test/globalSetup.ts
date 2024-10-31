import type { GlobalSetupContext } from 'vitest/node'
import { MongoClient } from 'mongodb'
import { getTestDbName, getTestDbParams } from './testUtil.js'

const TEST_MONGO_ROOT_USER = process.env.TEST_MONGO_ROOT_USER ?? 'root'
const TEST_MONGO_ROOT_PASSWORD =
  process.env.TEST_MONGO_ROOT_PASSWORD ?? 'example'
const VERBOSE = process.env.VERBOSE === 'true'

export async function setup({ config }: GlobalSetupContext) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('not test!!!')
  }
  const { userName, userPassword, host, port } = getTestDbParams()
  const TEST_ROOT_MONGODB_URI = `mongodb://${TEST_MONGO_ROOT_USER}:${TEST_MONGO_ROOT_PASSWORD}@${host}:${port}`

  const rootClient = await MongoClient.connect(TEST_ROOT_MONGODB_URI)

  const maxPool = config.poolOptions?.forks?.maxForks ?? 1

  const promises: ReturnType<typeof createMongoUser>[] = []
  for (let i = 1; i <= maxPool; i++) {
    const dbName = getTestDbName(`${i}`)
    // eslint-disable-next-line no-console
    console.log('[setupTestDB] dbname:', dbName)
    promises.push(createMongoUser(rootClient, dbName, userName, userPassword))
  }
  await Promise.all(promises)

  await rootClient.close()
}

async function createMongoUser(
  client: MongoClient,
  dbname: string,
  user: string,
  password: string
) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('not test!!!!')
  }
  try {
    await client.db(dbname).removeUser(user)
  } catch (e) {
    if (VERBOSE) {
      // eslint-disable-next-line no-console
      console.log('remove user:', e)
    }
  }

  await client.db(dbname).command({
    createUser: user,
    pwd: password,
    roles: ['readWrite', 'dbAdmin']
  })
  if (VERBOSE) {
    // eslint-disable-next-line no-console
    console.log('createMongoUser:', dbname, user)
  }
}
