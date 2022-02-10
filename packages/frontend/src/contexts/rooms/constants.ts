import { ReceiveRoom } from '../../type'

export type Message = {
  id: string
  userId: string
  iconUrl?: string
  userAccount: string
  message: string
  iine: number
  html?: string
  updated: boolean
  createdAt: string
}

export type RoomUser = {
  account: string
  icon: string
  userId: string
  enterId: string
}

export type Room = {
  id: string
  name: string
  iconUrl: string
  unread: number
  replied: number
  messages: string[]
  loading: boolean
  receivedMessages: boolean
  existHistory: boolean
  status: 'open' | 'close'
}

export type State = {
  rooms: {
    byId: { [key: string]: Room }
    allIds: string[]
    order: string[]
  }
  users: {
    byId: { [key: string]: { count: number; users: RoomUser[] | readonly [] } }
    allIds: string[]
  }
  currentRoomId: string
  currentRoomName: string
  currentRoomIcon: string
  scrollTargetIndex: number | 'bottom'
  openRoomSetting: boolean
}

const splited = window.location.pathname.split('/')
const initCurrentRoomName = splited[1] === 'rooms' ? splited[2] : ''

export const INITIAL_STATE: State = {
  rooms: {
    byId: {},
    allIds: [] as State['rooms']['allIds'],
    order: [] as State['rooms']['order']
  },
  users: { byId: {}, allIds: [] as State['users']['allIds'] },
  currentRoomId: '',
  currentRoomName: initCurrentRoomName,
  currentRoomIcon: null,
  scrollTargetIndex: 'bottom',
  openRoomSetting: false
} as const

export const Actions = {
  SetRooms: 'roomAction:setRooms',
  SetRoomOrder: 'roomAction:setRoomOrder',
  ReceiveMessage: 'roomAction:receiveMessage',
  ReceiveMessages: 'roomAction:receiveMessages',
  ReloadMessages: 'roomAction:reloadMessages',
  GetMessages: 'roomAction:getMessages',
  EnterRoomSuccess: 'roomAction:enterRoomSuccess',
  ExitRoom: 'roomAction:exitRoom',
  CreateRoom: 'roomAction:createRoom',
  ChangeRoom: 'roomAction:changeRoom',
  // 既読
  AlreadyRead: 'roomAction:alreadyRead',
  ToggleSetting: 'roomAction:toggleSetting',
  CloseSetting: 'roomAction:closeSetting',
  SetIcon: 'roomAction:setIcon',
  SetRoomUsers: 'roomAction:setRoomUsers',
  SetNextRoomUsers: 'roomAction:setNextRoomUsers',
  SetRoomStatus: 'roomAction:setRoomStatus'
} as const

export type ActionType =
  | {
      type: typeof Actions.SetRooms
      payload: { rooms: ReceiveRoom[]; roomOrder: string[] }
    }
  | {
      type: typeof Actions.ReceiveMessage
      payload: {
        messageId: string
        message: string
        room: string
        account: string
      }
    }
  | {
      type: typeof Actions.EnterRoomSuccess
      payload: { id: string; name: string; iconUrl: string; loading: boolean }
    }
  | {
      type: typeof Actions.ExitRoom
    }
  | {
      type: typeof Actions.CreateRoom
      payload: { id: string; name: string }
    }
  | {
      type: typeof Actions.ReceiveMessages
      payload: {
        room: string
        existHistory: boolean
        messages: string[]
      }
    }
  | {
      type: typeof Actions.ChangeRoom
      payload: {
        id: string
      }
    }
  | {
      type: typeof Actions.GetMessages
      payload: {
        id: string
      }
    }
  | {
      type: typeof Actions.AlreadyRead
      payload: {
        room: string
      }
    }
  | {
      type: typeof Actions.ReloadMessages
      payload: {
        room: string
      }
    }
  | { type: typeof Actions.ToggleSetting }
  | { type: typeof Actions.CloseSetting }
  | {
      type: typeof Actions.SetIcon
      payload: { id: string; version: string }
    }
  | {
      type: typeof Actions.SetRoomOrder
      payload: { roomOrder: string[]; allIds: string[] }
    }
  | {
      type: typeof Actions.SetRoomUsers
      payload: { room: string; users: RoomUser[]; count: number }
    }
  | {
      type: typeof Actions.SetNextRoomUsers
      payload: { room: string; users: RoomUser[] }
    }
  | {
      type: typeof Actions.SetRoomStatus
      payload: { id: string; status: 'open' | 'close' }
    }
