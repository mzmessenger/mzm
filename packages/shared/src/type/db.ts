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

/*
 * `Room` and `Enter` are deliberately NOT re-exported here: they need mongodb's
 * `ObjectId` and live in `./mongo.js`. Re-exporting them would put mongodb back
 * into the module graph of every browser and Worker build that reaches this
 * file through `../api/universal.js`.
 */
