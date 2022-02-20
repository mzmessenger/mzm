import { MongoClient, ObjectId } from 'mongodb'
import yargs from 'yargs'
import {
  User,
  Room,
  Enter,
  COLLECTION_NAMES
} from '../packages/backend/src/lib/db'

/**
 * node -r esbuild-register ./bin/add_test_users.ts --password=example --user=mzm
 */

const { password, user: dbUser } = yargs
  .option('password', {
    describe: 'root password',
    demandOption: true
  })
  .option('user', {
    describe: 'db user',
    demandOption: true
  }).argv

const createEnter = async (userId: ObjectId, client: MongoClient) => {
  const db = client.db('mzm')

  const general = await db.collection<Room>(COLLECTION_NAMES.ROOMS).findOne({
    name: 'general'
  })

  const existGeneral = await db
    .collection<Enter>(COLLECTION_NAMES.ENTER)
    .findOne({
      userId: userId,
      roomId: general._id
    })

  console.log('exist general')
  if (!existGeneral) {
    const enter: Enter = {
      userId: userId,
      roomId: general._id,
      unreadCounter: 0,
      replied: 0
    }

    console.log('create enter')
    await db.collection<Enter>(COLLECTION_NAMES.ENTER).findOneAndUpdate(
      { userId: userId, roomId: general._id },
      { $set: enter },
      {
        upsert: true
      }
    )

    console.log('add room order')
    await db.collection<User>(COLLECTION_NAMES.USERS).findOneAndUpdate(
      {
        _id: userId
      },
      {
        $addToSet: {
          roomOrder: general._id.toHexString()
        }
      }
    )
  }
}

const createUser = async (account: string, client: MongoClient) => {
  const db = client.db('mzm')

  console.log('create account:', account)
  const user = await db.collection<User>(COLLECTION_NAMES.USERS).findOne({
    account: account
  })

  if (user) {
    await createEnter(user._id, client)
  } else {
    const createUser = await db
      .collection<User>(COLLECTION_NAMES.USERS)
      .insertOne({
        account: account,
        roomOrder: []
      })

    await createEnter(createUser.insertedId, client)
  }

}

const main = async () => {
  const uri = `mongodb://${dbUser}:${password}@localhost:27017/mzm`
  const client = await MongoClient.connect(uri)

  for (let i = 0; i < 100; i++) {
    const account = `test_user_${i}`
    await createUser(account, client)
  }
  client.close()
}

main().catch(console.error)
