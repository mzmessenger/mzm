import { Dispatch } from 'redux'
import { useHistory } from 'react-router-dom'
import { State } from './index'
import { sendSocket, getRoomName } from '../lib/util'
import { SocketState, SocketAction, SocketActions } from './socket.types'
import {
  receiveRooms,
  receiveMessage,
  receiveMessages,
  enterSuccess,
  alreadyRead,
  reloadMessage,
  setRoomOrder,
  changeRoom
} from './rooms'
import {
  addMessages,
  addMessage,
  modifyMessage,
  updateIine,
  setVoteAnswers
} from './messages'
import { logout } from './user'
import { UserAction } from './user.types'
import { ReceiveSocketMessage, SendSocketMessage, SendSocketCmd } from '../type'

const DEFAULT_INTERVAL = 1000
const RECONNECT_DECAY = 1.5

export const initState: SocketState = {
  socket: null,
  reconnectInterval: 0,
  reconnectAttempts: 0,
  reconnectTimer: null
}

export const reducer = (
  state: SocketState = initState,
  action: SocketAction
): SocketState => {
  switch (action.type) {
    case SocketActions.Init: {
      const socket = action.payload
      return { ...state, socket: socket }
    }
    case SocketActions.Open: {
      if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer)
      }
      return {
        ...state,
        reconnectInterval: 0,
        reconnectAttempts: 0,
        reconnectTimer: null
      }
    }
    case SocketActions.Close: {
      const reconnectInterval =
        state.reconnectInterval <= 0
          ? DEFAULT_INTERVAL
          : state.reconnectInterval *
            Math.floor(Math.pow(RECONNECT_DECAY, state.reconnectAttempts))

      return {
        ...state,
        reconnectInterval,
        reconnectAttempts: state.reconnectAttempts + 1,
        reconnectTimer: action.payload.timer
      }
    }
    default:
      return state
  }
}

const onMessage = async (
  e: MessageEvent,
  dispatch: Dispatch,
  getState: () => State,
  history: ReturnType<typeof useHistory>
) => {
  try {
    const parsed: ReceiveSocketMessage = JSON.parse(e.data)
    if (parsed.cmd === 'rooms') {
      receiveRooms(
        parsed.rooms,
        parsed.roomOrder,
        getState().rooms.currentRoomId
      )(dispatch, getState)
    } else if (parsed.cmd === 'message:receive') {
      addMessage(parsed.message)(dispatch).then(() => {
        receiveMessage(
          parsed.message.id,
          parsed.message.message,
          parsed.room
        )(dispatch, getState)
      })
    } else if (parsed.cmd === 'message:modify') {
      modifyMessage(parsed.message)(dispatch).then(() => {
        dispatch(reloadMessage(parsed.room))
      })
    } else if (parsed.cmd === 'messages:room') {
      // wait converting html
      addMessages(parsed.messages)(dispatch).then(() => {
        receiveMessages({
          messageIds: parsed.messages.map((m) => m.id),
          room: parsed.room,
          existHistory: parsed.existHistory
        })(dispatch)
      })
    } else if (parsed.cmd === 'rooms:enter:success') {
      const currentPathRoomName = getRoomName(history.location.pathname)
      if (currentPathRoomName !== parsed.name) {
        history.push(`/rooms/${parsed.name}`)
        changeRoom(parsed.id)(dispatch, getState)
      }
      enterSuccess(parsed.id, parsed.name, parsed.iconUrl)(dispatch, getState)
    } else if (parsed.cmd === 'rooms:enter:fail') {
      history.push('/')
      sendSocket(getState().socket.socket, { cmd: SendSocketCmd.ROOMS_GET })
    } else if (parsed.cmd === 'rooms:read') {
      dispatch(alreadyRead(parsed.room))
    } else if (parsed.cmd === 'message:iine') {
      dispatch(updateIine(parsed.id, parsed.iine))
      dispatch(reloadMessage(parsed.room))
    } else if (parsed.cmd === 'rooms:sort:success') {
      setRoomOrder(parsed.roomOrder)(dispatch, getState)
    } else if (parsed.cmd === 'client:reload') {
      location.reload()
    } else if (parsed.cmd === 'vote:answers') {
      setVoteAnswers(parsed.messageId, parsed.answers)(dispatch)
    }
  } catch (e) {
    console.error(e)
  }
}

export const connect = (
  url: string,
  history: ReturnType<typeof useHistory>
) => {
  return (
    dispatch: Dispatch<SocketAction | UserAction>,
    getState: () => State
  ) => {
    const ws = new WebSocket(url)
    dispatch({ type: SocketActions.Init, payload: ws })

    ws.addEventListener('open', () => {
      const state = getState()
      if (state.rooms.currentRoomName) {
        sendSocket(ws, {
          cmd: SendSocketCmd.ROOMS_ENTER,
          name: state.rooms.currentRoomName
        })
      } else {
        sendSocket(ws, { cmd: SendSocketCmd.ROOMS_GET })
      }
      dispatch({ type: SocketActions.Open })
    })

    ws.addEventListener('message', (e) => {
      if (e.data === 'ping') {
        ws.send('pong')
        return
      }
      onMessage(e, dispatch, getState, history)
    })

    ws.addEventListener('close', (e) => {
      // @todo max recoonect
      const timer = setTimeout(() => {
        connect(url, history)(dispatch, getState)
      }, getState().socket.reconnectInterval)

      dispatch({ type: SocketActions.Close, payload: { timer } })
    })

    ws.addEventListener('error', () => {
      if (
        ws.readyState !== WebSocket.CLOSING &&
        ws.readyState !== WebSocket.CLOSED
      ) {
        ws.close()
      }

      dispatch(logout())
    })
  }
}

export const sendMessage = (
  message: string,
  roomId: string,
  vote?: { questions: { text: string }[] }
) => {
  return async (_dispatch: Dispatch, getState: () => State) => {
    const send: SendSocketMessage = {
      cmd: SendSocketCmd.MESSAGE_SEND,
      message: message,
      room: roomId
    }
    if (vote) {
      send.vote = vote
    }
    sendSocket(getState().socket.socket, send)
  }
}

export const sendModifyMessage = (message: string, messageId: string) => {
  return async (_dispatch: Dispatch, getState: () => State) => {
    const send: SendSocketMessage = {
      cmd: SendSocketCmd.MESSAGE_MODIFY,
      message: message,
      id: messageId
    }
    sendSocket(getState().socket.socket, send)
  }
}

export const incrementIine = (messageId: string) => {
  return async (_dispatch: Dispatch, getState: () => State) => {
    sendSocket(getState().socket.socket, {
      cmd: SendSocketCmd.MESSAGE_IINE,
      id: messageId
    })
  }
}

export const sortRoom = (roomOrder: string[]) => {
  return async (_dispatch: Dispatch, getState: () => State) => {
    sendSocket(getState().socket.socket, {
      cmd: SendSocketCmd.ROOMS_SORT,
      roomOrder
    })
  }
}

export const openRoom = (roomId: string) => {
  return async (_dispatch: Dispatch, getState: () => State) => {
    sendSocket(getState().socket.socket, {
      cmd: SendSocketCmd.ROOMS_OPEN,
      roomId
    })
  }
}

export const closeRoom = (roomId: string) => {
  return async (_dispatch: Dispatch, getState: () => State) => {
    sendSocket(getState().socket.socket, {
      cmd: SendSocketCmd.ROOMS_CLOSE,
      roomId
    })
  }
}
