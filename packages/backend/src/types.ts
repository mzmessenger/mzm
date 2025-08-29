export type UnreadQueue = {
  roomId: string
  messageId: string
}

export type ReplyQueue = {
  roomId: string
  userId: string
}

export type VoteQueue = {
  messageId: string
}

export const RoomQueueType = {
  INIT: 'RoomQueueType:INIT',
  ROOM: 'RoomQueueType:ROOM'
} as const

export const JobType = {
  SEARCH_ROOM: 'job:SEARCH_ROOM'
} as const
