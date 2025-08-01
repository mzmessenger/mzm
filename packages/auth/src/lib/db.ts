import { MongoClient, ObjectId } from 'mongodb'
import { MONGODB_URI, MONGO_SESSION_URI } from '../config.js'
import { logger } from './logger.js'

export function collections(c: MongoClient) {
  if (!c) {
    throw new Error('no db client')
  }

  return {
    users: c.db().collection<User>('users'),
    removed: c.db().collection<Removed>('removed'),
    authorizationCode: c.db().collection<AuthorizationCode>('authorizationCode')
  }
}

let _client: MongoClient | null = null

export async function createMongoClient() {
  if (!_client) {
    _client = await MongoClient.connect(MONGODB_URI)
    logger.info('[db] connected mongodb')
  }
  return _client
}

export async function sessionClient() {
  return await MongoClient.connect(MONGO_SESSION_URI)
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