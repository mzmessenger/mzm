import { MongoClient, Collection, ObjectId } from 'mongodb'
import { MONGODB_URI } from '../config.js'
import { logger } from './logger.js'

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
  twitterId?: string
  twitterUserName?: string
  githubId?: string
  githubUserName?: string
}

export type Removed = User & {
  originId: ObjectId
}
