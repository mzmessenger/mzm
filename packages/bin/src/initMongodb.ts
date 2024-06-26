#!/usr/bin/env node
import { MongoClient } from 'mongodb'

/**
 * node -r esbuild-register ./packages/bin/init_mongodb.ts --password=example --user=mzm --user_password=xxx --port=27018
 */

async function createUser(client: MongoClient, dbname: string, user: string, password: string) {
  try {
    await client.db(dbname).removeUser(user)
  } catch (e) {}

  console.log(`create user: ${user} to ${dbname}`)
  await client.db(dbname).command({
    createUser: user,
    pwd: password,
    roles: ['readWrite']
  })
}

export async function initMongoDb(root_password: string, user:string, user_password: string, port: string = '27017') {
  const client = await MongoClient.connect(
    `mongodb://root:${root_password}@localhost`
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
