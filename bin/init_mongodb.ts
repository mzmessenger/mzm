#!/usr/bin/env node
import { MongoClient } from 'mongodb'
import yargs from 'yargs'

/**
 * node -r esbuild-register ./bin/init_mongodb.ts --password=example --user=mzm --user_password=xxx --port=27018
 */

const { password, user, user_password, port } = yargs
  .option('password', {
    describe: 'root password',
    demandOption: true
  })
  .option('user', {
    describe: 'db user',
    demandOption: true
  })
  .option('user_password', {
    describe: 'db user password',
    demandOption: true
  })
  .option('port', {
    describe: 'db port',
    demandOption: true,
    default: '27017'
  }).argv

const createUser = async (client, dbname, user, password) => {
  try {
    await client.db(dbname).removeUser(user)
  } catch (e) {}

  console.log(`create user: ${user} to ${dbname}`)
  await client.db(dbname).addUser(user, password, {
    roles: ['readWrite']
  })
}

const main = async () => {
  const client = await MongoClient.connect(
    `mongodb://root:${password}@localhost`
  )

  await createUser(client, 'mzm', user, user_password)
  await createUser(client, 'auth', user, user_password)

  // index
  await client
    .db('mzm')
    .collection('rooms')
    .createIndex({ name: 1 }, { unique: true })

  await client.db('mzm').collection('enter').createIndex({ userId: 1 })

  await client
    .db('mzm')
    .collection('users')
    .createIndex({ account: 1 }, { unique: true })

  client.close()
}

main().catch(console.error)