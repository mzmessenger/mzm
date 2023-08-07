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
    'mzm-test',
    'mzm-backend-test',
    'mzm-backend-test-password'
  )

  await client.close()

  return async () => {
    const TEST_MONGODB_URI =
      process.env.TEST_MONTO_URI ??
      'mongodb://mzm-backend-test:mzm-backend-test-password@localhost:27018/mzm-test'

    const client = await MongoClient.connect(TEST_MONGODB_URI)
    const collections = await client.db().collections()
    for (const collection of collections) {
      await collection.drop()
    }
    await client.close()
  }
}
