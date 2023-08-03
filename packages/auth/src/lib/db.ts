import { MongoClient, Collection, ObjectId } from 'mongodb'
import { MONGODB_URI } from '../config.js'
import { logger } from './logger.js'

type CollectionType = {
  users: Collection<User>
  removed: Collection<Removed>
}

const _collections: Partial<CollectionType> = {
  users: undefined,
  removed: undefined
}

export const collections = (): CollectionType => {
  return {
    users: _collections.users!,
    removed: _collections.removed!
  }
}

export const connect = async () => {
  const client = await MongoClient.connect(MONGODB_URI)

  const db = client.db('auth')
  _collections.users = db.collection('users')
  _collections.removed = db.collection('removed')

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
