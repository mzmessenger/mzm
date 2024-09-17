import { MongoClient, ObjectId } from 'mongodb'
import {
  COLLECTION_NAMES,
  type User,
  type Room,
  type Enter
} from 'mzm-shared/src/type/db'

export async function createSeeds(dbUser: string, userPassword: string) {
  const uri = `mongodb://${dbUser}:${userPassword}@localhost:27017/mzm`
  const client = await MongoClient.connect(uri)

  for (let i = 0; i < 100; i++) {
    const account = `test_user_${i}`
    await createUser(account, client)
  }
  client.close()
}

async function createEnterGeneral(userId: ObjectId, generalRoomId: ObjectId, client: MongoClient) {
  const db = client.db('mzm')

  const existGeneral = await db
    .collection<Enter>(COLLECTION_NAMES.ENTER)
    .findOne({
      userId: userId,
      roomId: generalRoomId
    })

  console.log('exists')
  if (!existGeneral) {
    const enter: Enter = {
      userId: userId,
      roomId: generalRoomId,
      unreadCounter: 0,
      replied: 0
    }

    console.log('create enter')
    await db.collection<Enter>(COLLECTION_NAMES.ENTER).findOneAndUpdate(
      { userId: userId, roomId: generalRoomId },
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
          roomOrder: generalRoomId.toHexString()
        }
      }
    )
  }
}

async function createUser(account: string, client: MongoClient) {
  const db = client.db('mzm')

  console.log('create account:', account)
  const user = await db.collection<User>(COLLECTION_NAMES.USERS).findOne({
    account: account
  })

  const general = await db.collection<Room>(COLLECTION_NAMES.ROOMS).findOne({
    name: 'general'
  })

  if (!general) {
    return
  }

  if (user) {
    await createEnterGeneral(user._id, general._id, client)
  } else {
    const createUser = await db
      .collection<User>(COLLECTION_NAMES.USERS)
      .insertOne({
        account: account,
        roomOrder: []
      })

    await createEnterGeneral(createUser.insertedId, general._id, client)
  }
}
