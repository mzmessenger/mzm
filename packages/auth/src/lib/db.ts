import { MongoClient, Collection, ObjectId } from 'mongodb'
import { MONGODB_URI, MONGO_SESSION_URI } from '../config.js'
import { logger } from './logger.js'

type CollectionType = {
  users: Collection<User>
  removed: Collection<Removed>
  authorizationCode: Collection<AuthorizationCode>
}

const _collections: Partial<CollectionType> = {
  users: undefined,
  removed: undefined,
  authorizationCode: undefined
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
    _collections.authorizationCode = db.collection('authorizationCode')
  }

  return {
    users: _collections.users!,
    removed: _collections.removed!,
    authorizationCode: _collections.authorizationCode!
  }
}

let _client: MongoClient | null = null

export const mongoClient = async () => {
  if (!_client) {
    _client = await MongoClient.connect(MONGODB_URI)
  }
  return _client
}

export async function sessionClient() {
  return await MongoClient.connect(MONGO_SESSION_URI)
}

export const connect = async (c: MongoClient) => {
  const db = c.db()
  _collections.users = db.collection('users')
  _collections.removed = db.collection('removed')
  _collections.authorizationCode = db.collection('authorizationCode')

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

export type AuthorizationCode = {
  code: string
  code_challenge: string
  code_challenge_method: string
  userId: string
  createdAt: Date
}