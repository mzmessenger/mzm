import type { VoteStatusEnum } from './db.js'

export const TO_CLIENT_CMD = {
  CLIENT_RELOAD: 'client:reload',
  SOCKET_CONNECTION: 'socket:connection',
  MESSAGE_RECEIVE: 'message:receive',
  MESSAGE_MODIFY: 'message:modify',
  MESSAGE_REMOVE: 'message:remove',
  MESSAGE_IINE: 'message:iine',
  MESSAGES_ROOM: 'messages:room',
  ROOMS_GET: 'rooms',
  ROOMS_ENTER_SUCCESS: 'rooms:enter:success',
  ROOMS_ENTER_FAIL: 'rooms:enter:fail',
  ROOMS_READ: 'rooms:read',
  ROOMS_SORT_SUCCESS: 'rooms:sort:success',
  ROOMS_UPDATE_DESCRIPTION: 'rooms:update:description',
  VOTE_ANSWERS: 'vote:answers'
} as const

type VoteType = {
  questions: { text: string }[]
  answers: {
    answer: number
    index: number
    userId: string
    userAccount: string
    icon: string | null
  }[]
  status: (typeof VoteStatusEnum)[keyof typeof VoteStatusEnum]
}

export type MessageType = {
  id: string
  userId: string
  message: string
  iine: number
  updated: boolean
  removed: boolean
  createdAt: string
  updatedAt: string | null
  userAccount: string
  icon: string | null
  vote?: VoteType
}

export type FilterToClientType<P extends ToClientType['cmd']> = Extract<
  ToClientType,
  { cmd: P }
>

export type ToClientType =
  | { cmd: typeof TO_CLIENT_CMD.CLIENT_RELOAD; user?: string }
  | {
      cmd: typeof TO_CLIENT_CMD.SOCKET_CONNECTION
      user: string
      signup: boolean
    }
  | {
      user: string
      cmd: typeof TO_CLIENT_CMD.ROOMS_GET
      rooms: {
        id: string
        name: string
        description: string
        iconUrl: string | null
        unread: number
        replied: number
        status: 'open' | 'close'
      }[]
      roomOrder: string[]
    }
  | {
      user: string | null
      cmd: typeof TO_CLIENT_CMD.MESSAGE_RECEIVE
      message: MessageType
      room: string
    }
  | {
      user: string
      cmd: typeof TO_CLIENT_CMD.MESSAGES_ROOM
      messages: MessageType[]
      room: string
      existHistory: boolean
    }
  | {
      user: string
      cmd: typeof TO_CLIENT_CMD.ROOMS_ENTER_SUCCESS
      id: string
      name: string
      iconUrl: string | null
      description: string
    }
  | {
      user: string
      cmd: typeof TO_CLIENT_CMD.ROOMS_ENTER_FAIL
      id: string | null
      name: string | null
      reason: string | null
    }
  | {
      user: string
      cmd: typeof TO_CLIENT_CMD.MESSAGE_MODIFY
      message: MessageType
      room: string
    }
  | {
      user: string
      cmd: typeof TO_CLIENT_CMD.MESSAGE_REMOVE
      message: MessageType
      room: string
    }
  | {
      user: string
      cmd: typeof TO_CLIENT_CMD.ROOMS_READ
      room: string
    }
  | {
      cmd: typeof TO_CLIENT_CMD.MESSAGE_IINE
      user?: string
      room: string
      id: string
      iine: number
    }
  | {
      user: string
      cmd: typeof TO_CLIENT_CMD.ROOMS_SORT_SUCCESS
      roomOrder: string[]
    }
  | {
      user?: string
      cmd: typeof TO_CLIENT_CMD.VOTE_ANSWERS
      messageId: string
      answers: VoteType['answers']
    }
  | {
      user?: string
      cmd: typeof TO_CLIENT_CMD.ROOMS_UPDATE_DESCRIPTION
      roomId: string
      descrioption: string
    }

export const TO_SERVER_CMD = {
  CONNECTION: 'socket:connection',
  ROOMS_GET: 'rooms:get',
  ROOMS_ENTER: 'rooms:enter',
  ROOMS_READ: 'rooms:read',
  ROOMS_SORT: 'rooms:sort',
  ROOMS_OPEN: 'rooms:open',
  ROOMS_CLOSE: 'rooms:close',
  ROOMS_UPDATE_DESCRIPTION: 'rooms:update:description',
  MESSAGE_SEND: 'message:send',
  MESSAGE_IINE: 'message:iine',
  MESSAGE_MODIFY: 'message:modify',
  MESSAGE_REMOVE: 'message:remove',
  MESSAGES_ROOM: 'messages:room',
  VOTE_ANSWER_SEND: 'vote:answer:send',
  VOTE_ANSWER_REMOVE: 'vote:answer:remove'
} as const

export type FilterSocketToBackendType<P extends SocketToBackendType['cmd']> =
  Extract<SocketToBackendType, { cmd: P }>

export type ClientToSocketType =
  | GetRooms
  | SendMessage
  | ModifyMessage
  | RemoveMessage
  | IineMessage
  | GetMessages
  | EnterRoom
  | ReadMessage
  | SortRooms
  | OpenRoom
  | CloseRoom
  | UpdateRoomsDescription
  | SendVoteAnswer
  | RemoveVoteAnswer

export type SocketToBackendType =
  | {
      cmd: typeof TO_SERVER_CMD.CONNECTION
      payload: { user: string; twitterUserName: string; githubUserName: string }
    }
  | ClientToSocketType

type GetRooms = {
  cmd: typeof TO_SERVER_CMD.ROOMS_GET
}

type SendMessage = {
  cmd: typeof TO_SERVER_CMD.MESSAGE_SEND
  message: string
  room: string
  vote?: {
    questions: {
      text: string
    }[]
  }
}

type ModifyMessage = {
  cmd: typeof TO_SERVER_CMD.MESSAGE_MODIFY
  id: string
  message: string
}

type RemoveMessage = {
  cmd: typeof TO_SERVER_CMD.MESSAGE_REMOVE
  id: string
}

type IineMessage = {
  cmd: typeof TO_SERVER_CMD.MESSAGE_IINE
  id: string
}

type GetMessages = {
  cmd: typeof TO_SERVER_CMD.MESSAGES_ROOM
  room: string
  id?: string
}

type EnterRoom = {
  cmd: typeof TO_SERVER_CMD.ROOMS_ENTER
  id?: string
  name?: string
}

type ReadMessage = {
  cmd: typeof TO_SERVER_CMD.ROOMS_READ
  room?: string
}

type SortRooms = {
  cmd: typeof TO_SERVER_CMD.ROOMS_SORT
  roomOrder?: string[]
}

type OpenRoom = { cmd: typeof TO_SERVER_CMD.ROOMS_OPEN; roomId: string }

type CloseRoom = { cmd: typeof TO_SERVER_CMD.ROOMS_CLOSE; roomId: string }

type UpdateRoomsDescription = {
  cmd: typeof TO_SERVER_CMD.ROOMS_UPDATE_DESCRIPTION
  roomId: string
  description: string
}

type SendVoteAnswer = {
  cmd: typeof TO_SERVER_CMD.VOTE_ANSWER_SEND
  messageId: string
  index: number
  answer: number
}

type RemoveVoteAnswer = {
  cmd: typeof TO_SERVER_CMD.VOTE_ANSWER_REMOVE
  messageId: string
  index: number
}
