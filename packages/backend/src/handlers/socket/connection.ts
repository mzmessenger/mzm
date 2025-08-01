import { TO_CLIENT_CMD, ToClientType } from 'mzm-shared/src/type/socket'
import { randomUUID } from 'node:crypto'
import { ObjectId, type MongoClient } from 'mongodb'
import { collections } from '../../lib/db.js'
import { initUser } from '../../logic/users.js'

export async function connection(
  db: MongoClient,
  userId: string,
  payload: {
    twitterUserName: string | null
    githubUserName: string | null
  }
): Promise<ToClientType> {
  const id = new ObjectId(userId)
  const user = await collections(db).users.findOne({
    _id: id
  })

  let signup = false

  if (!user || !user.account || user.account === '') {
    const account =
      payload.twitterUserName ?? payload.githubUserName ?? randomUUID()
    await initUser(db, id, account)
    signup = true
  }

  return {
    cmd: TO_CLIENT_CMD.SOCKET_CONNECTION,
    user: userId,
    signup
  }
}
