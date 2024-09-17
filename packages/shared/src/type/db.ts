import type { ObjectId } from 'mongodb'

export const VoteStatusEnum = {
  CLOSE: 0,
  OPEN: 1
} as const

export const VoteTypeEnum = {
  CHOICE: 'CHOICE'
} as const

export const RoomStatusEnum = {
  CLOSE: 0,
  OPEN: 1
} as const

export const COLLECTION_NAMES = {
  ROOMS: 'rooms',
  USERS: 'users',
  ENTER: 'enter',
  MESSAGES: 'messages',
  REMOVED: 'removed',
  VOTE_ANSWER: 'voteAnswers'
} as const

export type User = {
  account: string
  icon?: {
    key: string
    version: string
  }
  roomOrder: string[]
}

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
