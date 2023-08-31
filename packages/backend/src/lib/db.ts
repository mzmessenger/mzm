import { MongoClient, Collection, ObjectId } from 'mongodb'
import { VoteStatusEnum, VoteTypeEnum } from 'mzm-shared/src/type/db'
import { MONGODB_URI } from '../config.js'
import { logger } from './logger.js'

type CollectionType = {
  rooms: Collection<Room>
  enter: Collection<Enter>
  users: Collection<User>
  removed: Collection<Removed>
  messages: Collection<Message>
  voteAnswer: Collection<VoteAnswer>
}

const _collections: Partial<CollectionType> = {
  rooms: undefined,
  enter: undefined,
  users: undefined,
  messages: undefined,
  removed: undefined,
  voteAnswer: undefined
} as const

let connected = false

const initCollections = (c: MongoClient): CollectionType => {
  const db = c.db()
  const rooms = db.collection<Room>(COLLECTION_NAMES.ROOMS)
  const enter = db.collection<Enter>(COLLECTION_NAMES.ENTER)
  const users = db.collection<User>(COLLECTION_NAMES.USERS)
  const messages = db.collection<Message>(COLLECTION_NAMES.MESSAGES)
  const removed = db.collection<Removed>(COLLECTION_NAMES.REMOVED)
  const voteAnswer = db.collection<VoteAnswer>(COLLECTION_NAMES.VOTE_ANSWER)

  _collections.rooms = rooms
  _collections.enter = enter
  _collections.users = users
  _collections.messages = messages
  _collections.removed = removed
  _collections.voteAnswer = voteAnswer

  return {
    rooms,
    enter,
    users,
    messages,
    removed,
    voteAnswer
  }
}

export const collections = (c: MongoClient): CollectionType => {
  if (!c) {
    throw new Error('no db client')
  }

  if (!connected) {
    initCollections(c)
  }

  return _collections as CollectionType
}

export const COLLECTION_NAMES = {
  ROOMS: 'rooms',
  USERS: 'users',
  ENTER: 'enter',
  MESSAGES: 'messages',
  REMOVED: 'removed',
  VOTE_ANSWER: 'voteAnswers'
} as const

let _client: MongoClient | null = null

export const mongoClient = async () => {
  if (!_client) {
    _client = await MongoClient.connect(MONGODB_URI)
  }
  return _client
}

export const connect = async (c: MongoClient) => {
  initCollections(c)
  connected = true

  if (process.env.NODE_ENV !== 'test') {
    logger.info('[db] connected mongodb')
  }

  return c
}

export const close = async (c: MongoClient) => {
  c.close()
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
