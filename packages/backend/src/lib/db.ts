import { MongoClient, Collection, ObjectId } from 'mongodb'
import { VoteStatusEnum, VoteTypeEnum } from 'mzm-shared/type/db'
import { MONGODB_URI } from '../config.js'
import { logger } from './logger.js'

export const collections: {
  rooms: Collection<Room>
  enter: Collection<Enter>
  users: Collection<User>
  removed: Collection<Removed>
  messages: Collection<Message>
  voteAnswer: Collection<VoteAnswer>
} = {
  rooms: null,
  enter: null,
  users: null,
  messages: null,
  removed: null,
  voteAnswer: null
} as const

export const COLLECTION_NAMES = {
  ROOMS: 'rooms',
  USERS: 'users',
  ENTER: 'enter',
  MESSAGES: 'messages',
  REMOVED: 'removed',
  VOTE_ANSWER: 'voteAnswers'
} as const

let connection: MongoClient = null

export const connect = async (uri: string = MONGODB_URI) => {
  if (connection) {
    return connection
  }

  const client = await MongoClient.connect(uri)

  const db = client.db('mzm')
  collections.rooms = db.collection<Room>(COLLECTION_NAMES.ROOMS)
  collections.enter = db.collection<Enter>(COLLECTION_NAMES.ENTER)
  collections.users = db.collection<User>(COLLECTION_NAMES.USERS)
  collections.messages = db.collection<Message>(COLLECTION_NAMES.MESSAGES)
  collections.removed = db.collection<Removed>(COLLECTION_NAMES.REMOVED)
  collections.voteAnswer = db.collection<VoteAnswer>(
    COLLECTION_NAMES.VOTE_ANSWER
  )

  if (process.env.NODE_ENV !== 'test') {
    logger.info('[db] connected mongodb')
  }

  // eslint-disable-next-line require-atomic-updates
  connection = client

  return client
}

export const close = async () => {
  connection.close()
}

export const RoomStatusEnum = {
  CLOSE: 0,
  OPEN: 1
} as const

export type Room = {
  name: string
  description?: string
  createdBy: string
  updatedBy?: ObjectId
  icon?: {
    key: string
    version: string
  }
  status: (typeof RoomStatusEnum)[keyof typeof RoomStatusEnum]
}

export type Enter = {
  roomId: ObjectId
  userId: ObjectId
  unreadCounter: number
  replied: number
}

export type User = {
  account: string
  icon?: {
    key: string
    version: string
  }
  roomOrder: string[]
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
