import { isReplied } from '../../lib/util'
import { State, INITIAL_STATE, ActionType, Actions, Room } from './constants'

export const reducer = (
  state: State = INITIAL_STATE,
  action: ActionType
): State => {
  switch (action.type) {
    case Actions.SetRooms: {
      const { rooms, roomOrder } = action.payload
      const allIds = []
      for (const r of rooms) {
        if (!allIds.includes(r.id)) {
          allIds.push(r.id)

          const room: Room = {
            id: r.id,
            name: r.name,
            description: r.description,
            iconUrl: r.iconUrl,
            unread: r.unread,
            replied: r.replied,
            messages: [],
            loading: false,
            receivedMessages: false,
            existHistory: false,
            status: r.status
          }
          state.rooms.byId[r.id] = room
        }
      }
      allIds.sort((a, b) => roomOrder.indexOf(a) - roomOrder.indexOf(b))
      state.rooms.allIds = allIds
      state.rooms.order = roomOrder
      return { ...state }
    }
    case Actions.SetRoomDescription: {
      const room = state.rooms.byId[action.payload.roomId]
      if (room) {
        state.rooms.byId[action.payload.roomId] = {
          ...room,
          description: action.payload.description
        }
      }
      return { ...state }
    }
    case Actions.SetRoomOrder: {
      state.rooms.order = [...action.payload.roomOrder]
      state.rooms.allIds = [...action.payload.allIds]
      return { ...state }
    }
    case Actions.CreateRoom: {
      return {
        ...state,
        currentRoomId: action.payload.id,
        currentRoomName: action.payload.name,
        currentRoomIcon: '',
        currentRoomDescription: ''
      }
    }
    case Actions.GetMessages: {
      const room = state.rooms.byId[action.payload.id]
      if (room) {
        state.rooms.byId[action.payload.id] = { ...room, loading: true }
      }
      return { ...state }
    }
    case Actions.ChangeRoom: {
      return {
        ...state,
        currentRoomId: action.payload.id,
        currentRoomName: state.rooms.byId[action.payload.id].name,
        currentRoomIcon: state.rooms.byId[action.payload.id].iconUrl,
        currentRoomDescription: state.rooms.byId[action.payload.id].description,
        scrollTargetIndex: 'bottom',
        openRoomSetting: false
      }
    }
    case Actions.EnterRoomSuccess: {
      const room = state.rooms.byId[action.payload.id]
      if (room) {
        state.rooms.byId[action.payload.id] = {
          ...state.rooms.byId[action.payload.id],
          loading: action.payload.loading
        }
      }

      return {
        ...state,
        currentRoomId: action.payload.id,
        currentRoomName: action.payload.name,
        currentRoomIcon: action.payload.iconUrl,
        currentRoomDescription: action.payload.description
      }
    }
    case Actions.ExitRoom: {
      return {
        ...state,
        currentRoomId: '',
        currentRoomName: '',
        currentRoomIcon: '',
        currentRoomDescription: ''
      }
    }
    case Actions.ReceiveMessage: {
      const isCurrent = action.payload.room === state.currentRoomId
      const room = state.rooms.byId[action.payload.room]
      const replied = isReplied(action.payload.account, action.payload.message)

      state.rooms.byId[action.payload.room] = {
        ...room,
        messages: [...room.messages, action.payload.messageId],
        loading: false,
        unread: isCurrent ? room.unread : room.unread + 1,
        replied: replied ? room.replied + 1 : room.replied
      }
      state.rooms.allIds = [...state.rooms.allIds]

      return {
        ...state,
        scrollTargetIndex:
          action.payload.room === state.currentRoomId
            ? 'bottom'
            : state.scrollTargetIndex
      }
    }
    case Actions.ReceiveMessages: {
      const roomId = action.payload.room
      // uniq
      const arr = [
        ...action.payload.messages,
        ...state.rooms.byId[roomId].messages
      ]
      const messages = [...new Set(arr)]

      const scrollTargetIndex =
        action.payload.room === state.currentRoomId &&
        !state.rooms.byId[roomId].receivedMessages
          ? action.payload.messages.length
          : state.scrollTargetIndex

      const room = {
        ...state.rooms.byId[roomId],
        messages,
        loading: false,
        receivedMessages: true,
        existHistory: action.payload.existHistory
      }
      state.rooms.byId[roomId] = room

      return {
        ...state,
        scrollTargetIndex
      }
    }
    case Actions.AlreadyRead: {
      state.rooms.byId[action.payload.room] = {
        ...state.rooms.byId[action.payload.room],
        unread: 0,
        replied: 0
      }
      state.rooms.allIds = [...state.rooms.allIds]
      return { ...state }
    }
    case Actions.ReloadMessages: {
      state.rooms.byId[action.payload.room].messages = [
        ...state.rooms.byId[action.payload.room].messages
      ]
      return state
    }
    case Actions.ToggleSetting:
      return { ...state, openRoomSetting: !state.openRoomSetting }
    case Actions.SetRoomUsers: {
      state.users.byId[action.payload.room] = {
        users: action.payload.users,
        count: action.payload.count
      }
      if (!state.users.allIds.includes(action.payload.room)) {
        state.users.allIds = [...state.users.allIds, action.payload.room]
      }
      return { ...state }
    }
    case Actions.SetNextRoomUsers: {
      const users = state.users.byId[action.payload.room]
      state.users.byId[action.payload.room] = {
        ...users,
        users: [...users.users, ...action.payload.users]
      }
      return { ...state }
    }
    case Actions.SetRoomStatus: {
      const room = state.rooms.byId[action.payload.id]
      state.rooms.byId[action.payload.id] = {
        ...room,
        status: action.payload.status
      }
      return { ...state }
    }
    default:
      return state
  }
}
