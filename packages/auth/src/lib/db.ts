import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
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


export async function createMongoClient() {
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  })
  await client.connect()
  logger.info('[db] connected mongodb')
  return client
}

export async function sessionClient() {
  const client = new MongoClient(MONGO_SESSION_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  })
  await client.connect()
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

export type AuthorizationCode = {
  code: string
  code_challenge: string
  code_challenge_method: string
  userId: string
  createdAt: Date
}
