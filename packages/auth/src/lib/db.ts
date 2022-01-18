import { MongoClient, Collection, ObjectId } from 'mongodb'
import { MONGODB_URI } from '../config'
import logger from './logger'

export const collections: {
  users: Collection<User>
  removed: Collection<Removed>
} = { users: null, removed: null }

export const connect = async () => {
  const client = await MongoClient.connect(MONGODB_URI)

  const db = client.db('auth')
  collections.users = db.collection('users')
  collections.removed = db.collection('removed')

  logger.info('[db] connected mongodb')

  return client
}

export type User = {
  _id: ObjectId
  twitterId?: string
  twitterUserName?: string
  githubId?: string
  githubUserName?: string
}

export type Removed = User & {
  originId: ObjectId
}
