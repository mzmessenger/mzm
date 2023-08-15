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

let connected = false

export const collections = (c: MongoClient): CollectionType => {
  if (!c) {
    throw new Error('no db client')
  }

  if (!connected) {
    const db = c.db()
    _collections.users = db.collection('users')
    _collections.removed = db.collection('removed')
  }

  return {
    users: _collections.users!,
    removed: _collections.removed!
  }
}

let _client: MongoClient | null = null

export const mongoClient = async () => {
  if (!_client) {
    _client = await MongoClient.connect(MONGODB_URI)
  }
  return _client
}

export const connect = async (c: MongoClient) => {
  const db = c.db()
  _collections.users = db.collection('users')
  _collections.removed = db.collection('removed')

  connected = true

  logger.info('[db] connected mongodb')

  return mongoClient
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
