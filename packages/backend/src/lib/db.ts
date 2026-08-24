import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import {
  VoteStatusEnum,
  VoteTypeEnum,
  COLLECTION_NAMES,
  type User
} from 'mzm-shared/src/type/db'
import type { Room, Enter } from 'mzm-shared/src/type/mongo'
import { MONGODB_URI } from '../config.js'
import { logger } from './logger.js'
import { initializeOutboxIndexes } from './db/outbox.js'

export {
  COLLECTION_NAMES,
  RoomStatusEnum,
  type User
} from 'mzm-shared/src/type/db'
export type { Room, Enter } from 'mzm-shared/src/type/mongo'

function initCollections(c: MongoClient) {
  const db = c.db()
  const rooms = db.collection<Room>(COLLECTION_NAMES.ROOMS)
  const enter = db.collection<Enter>(COLLECTION_NAMES.ENTER)
  const users = db.collection<User>(COLLECTION_NAMES.USERS)
  const messages = db.collection<Message>(COLLECTION_NAMES.MESSAGES)
  const removed = db.collection<Removed>(COLLECTION_NAMES.REMOVED)
  const voteAnswer = db.collection<VoteAnswer>(COLLECTION_NAMES.VOTE_ANSWER)

  return {
    rooms,
    enter,
    users,
    messages,
    removed,
    voteAnswer
  }
}

export function collections(c: MongoClient) {
  if (!c) {
    throw new Error('no db client')
  }

  return initCollections(c)
}

export async function initMongoClient() {
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true
    }
  })
  await client.connect()
  await verifyTransactionSupport(client)
  logger.info('[db] connected mongodb')
  return client
}

export async function verifyTransactionSupport(client: MongoClient) {
  const probe = client.db().collection<{ _id: ObjectId }>('transaction_probes')
  const _id = new ObjectId()
  await client.withSession(async (session) => {
    await session.withTransaction(async () => {
      await probe.insertOne({ _id }, { session })
      await probe.deleteOne({ _id }, { session })
    })
  })
}

export async function initIndexes(c: MongoClient) {
  const db = collections(c)
  await Promise.all([
    db.rooms.createIndex({ name: 1 }, { unique: true }),
    db.enter.createIndex({ userId: 1, roomId: 1 }, { unique: true }),
    initializeOutboxIndexes(c)
  ])
}

export async function close(c: MongoClient) {
  await c.close()
}

export type Removed = {
  account: string
  originId: ObjectId
  enter: ObjectId[]
}

export type Message = {
  message: string
  iine: number
  roomId: ObjectId
  userId: ObjectId
  updated: boolean
  removed: boolean
  createdAt: Date
  updatedAt: Date | null
  vote?: Vote
}

type Vote = {
  questions: {
    text: string
  }[]
  status: (typeof VoteStatusEnum)[keyof typeof VoteStatusEnum]
  type: (typeof VoteTypeEnum)[keyof typeof VoteTypeEnum]
}

export const VoteAnswerEnum = {
  OK: 0,
  NG: 1,
  NA: 2
} as const

export type VoteAnswer = {
  messageId: ObjectId
  userId: ObjectId
  index: number
  answer: (typeof VoteAnswerEnum)[keyof typeof VoteAnswerEnum]
}
