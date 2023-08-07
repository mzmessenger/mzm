/* eslint-disable no-console */
import { MongoClient } from 'mongodb'

const TEST_ROOT_MONGODB_URI =
  process.env.TEST_ROOT_MONGODB_URI ?? 'mongodb://root:example@localhost:27018'

const createUser = async (
  client: MongoClient,
  dbname: string,
  user: string,
  password: string
) => {
  try {
    await client.db(dbname).removeUser(user)
  } catch (e) {
    /* empty */
  }

  console.log(`create user: ${user} to ${dbname}`)
  await client.db(dbname).addUser(user, password, {
    roles: ['readWrite']
  })
}

export async function setup() {
  const client = await MongoClient.connect(TEST_ROOT_MONGODB_URI)

  await createUser(
    client,
    'auth-test',
    'mzm-auth-test',
    'mzm-auth-test-password'
  )

  await client.close()

  return async () => {
    const { getTestMongoClient, getTestRedisClient } = await import(
      './testUtil.js'
    )

    const mongoClient = await getTestMongoClient()
    await mongoClient.close(true)
    const { sessionRedis } = await getTestRedisClient()
    await sessionRedis.disconnect()
  }
}
