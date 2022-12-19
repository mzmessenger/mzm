import { useCallback } from 'react'
import { atom, useRecoilState } from 'recoil'
import dayjs from 'dayjs'
import {
  ClientToSocketType,
  TO_SERVER_CMD,
  ToClientType,
  FilterToClientType
} from 'mzm-shared/type/socket'
import { sendSocket } from '../../lib/util'
import { useAuth } from '../auth/hooks'

const DEFAULT_INTERVAL = 1000
const RECONNECT_DECAY = 1.5
const MAX_RECONNECT = 10
const INIT_RECONNECT_INTERVAL = 10

type HandlerArgs<P extends ToClientType['cmd']> = {
  ws: WebSocket
  message: FilterToClientType<P>
}
type MessageHandlers = {
  [P in ToClientType['cmd']]?: (args: HandlerArgs<P>) => void
}

type InitOptions = {
  url: string
  messageHandlers: MessageHandlers
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

type SocketState = {
  ws: WebSocket | null
  connecting: boolean
}

const socketAtom = atom<SocketState>({
  key: 'state:socket',
  default: {
    ws: null,
    connecting: false
  }
})

type SocketRecoonectState = {
  reconnectInterval: number
  reconnectAttempts: number
}

const socketRecoonectAtom = atom<SocketRecoonectState>({
  key: 'state:socket:reconnect',
  default: {
    reconnectInterval: INIT_RECONNECT_INTERVAL,
    reconnectAttempts: 0
  }
})

export const useSocket = () => {
  const { getAccessToken } = useAuth()
  const [socketState, setSocketState] = useRecoilState(socketAtom)
  const [socketRecoonectState, setSocketRecoonectState] =
    useRecoilState(socketRecoonectAtom)

  const close = useCallback(
    (socket: WebSocket) => {
      if (
        socket &&
        socket.readyState !== WebSocket.CLOSING &&
        socket.readyState !== WebSocket.CLOSED
      ) {
        socketState.ws.close()
      }
    },
    [socketState.ws]
  )

  const setOnMessageHandlers = useCallback(
    (ws: WebSocket, handlers: MessageHandlers) => {
      ws.onmessage = (e) => {
        if (!e) {
          return
        }
        if (e.data === 'ping') {
          ws.send('pong')
          return
        }
        try {
          const parsed: ToClientType = JSON.parse(e.data)
          if (handlers[parsed.cmd]) {
            const handler = handlers[parsed.cmd]
            const args: HandlerArgs<typeof parsed.cmd> = {
              ws: ws,
              message: parsed
            }
            // @todo
            handler(args as any)
          }
        } catch (err) {
          console.error(err)
        }
      }
    },
    []
  )

  const connect = useCallback(
    async (connectUrl: string, handlers: MessageHandlers) => {
      if (socketState.ws || socketState.connecting) {
        return
      }

      setSocketState((current) => {
        return { ...current, connecting: true }
      })
      const { accessToken } = await getAccessToken()
      const socketInstance = new WebSocket(connectUrl + `?token=${accessToken}`)

      setSocketState((current) => {
        return { ...current, ws: socketInstance }
      })

      socketInstance.addEventListener('open', () => {
        console.log('ws open')
        setSocketState((current) => {
          return {
            ...current,
            connecting: false
          }
        })
        setSocketRecoonectState({
          reconnectInterval: INIT_RECONNECT_INTERVAL,
          reconnectAttempts: 0
        })
      })

      setOnMessageHandlers(socketInstance, handlers)

      const reconnect = async () => {
        const counter = socketRecoonectState.reconnectAttempts + 1
        setSocketRecoonectState((current) => {
          return {
            ...current,
            reconnectAttempts: counter
          }
        })

        if (counter >= MAX_RECONNECT) {
          return
        }

        console.warn(
          `ws reconnect: ${socketRecoonectState.reconnectAttempts} `,
          dayjs().format('YYYY/MM/DD HH:mm:ss'),
          socketRecoonectState.reconnectInterval
        )

        await sleep(socketRecoonectState.reconnectInterval)
        connect(connectUrl, handlers)

        const newInterval =
          socketRecoonectState.reconnectInterval <= INIT_RECONNECT_INTERVAL
            ? DEFAULT_INTERVAL
            : socketRecoonectState.reconnectInterval *
              Math.floor(
                Math.pow(
                  RECONNECT_DECAY,
                  socketRecoonectState.reconnectAttempts
                )
              )

        setSocketRecoonectState((current) => {
          return {
            ...current,
            reconnectInterval: newInterval
          }
        })
      }

      socketInstance.addEventListener('close', (e) => {
        console.warn('ws close:', e)
        try {
          close(socketInstance)
          reconnect()
        } catch (err) {
          console.error(err)
        }
      })

      socketInstance.addEventListener('error', (e) => {
        console.warn('ws error:', e)
        try {
          close(socketInstance)
          reconnect()
        } catch (err) {
          console.error(err)
        }
      })
    },
    [
      close,
      getAccessToken,
      setOnMessageHandlers,
      setSocketRecoonectState,
      setSocketState,
      socketRecoonectState.reconnectAttempts,
      socketRecoonectState.reconnectInterval,
      socketState.connecting,
      socketState.ws
    ]
  )

  const init = useCallback(
    (options: InitOptions) => {
      if (!options.url || options.url === '') {
        throw new Error('no url')
      }

      connect(options.url, options.messageHandlers)
    },
    [connect]
  )

  const getMessages = (roomId: string, socket?: WebSocket) => {
    const sendTo = socket ?? socketState.ws
    sendSocket(sendTo, {
      cmd: TO_SERVER_CMD.MESSAGES_ROOM,
      room: roomId
    })
  }

  const getRooms = (socket?: WebSocket) => {
    const sendTo = socket ?? socketState.ws
    sendSocket(sendTo, { cmd: TO_SERVER_CMD.ROOMS_GET })
  }

  const sortRoom = (roomOrder: string[]) => {
    sendSocket(socketState.ws, {
      cmd: TO_SERVER_CMD.ROOMS_SORT,
      roomOrder
    })
  }

  const incrementIine = (messageId: string) => {
    sendSocket(socketState.ws, {
      cmd: TO_SERVER_CMD.MESSAGE_IINE,
      id: messageId
    })
  }

  const sendMessage = (
    message: string,
    roomId: string,
    vote?: { questions: { text: string }[] }
  ) => {
    const send: ClientToSocketType = {
      cmd: TO_SERVER_CMD.MESSAGE_SEND,
      message: message,
      room: roomId
    }
    if (vote) {
      send.vote = vote
    }
    sendSocket(socketState.ws, send)
  }

  const enterRoom = (roomName: string) => {
    sendSocket(socketState.ws, {
      cmd: TO_SERVER_CMD.ROOMS_ENTER,
      name: encodeURIComponent(roomName)
    })
  }

  const sendModifyMessage = (message: string, messageId: string) => {
    const send: ClientToSocketType = {
      cmd: TO_SERVER_CMD.MESSAGE_MODIFY,
      message: message,
      id: messageId
    }
    sendSocket(socketState.ws, send)
  }

  const sendDeleteMessage = (messageId: string) => {
    const send: ClientToSocketType = {
      cmd: TO_SERVER_CMD.MESSAGE_REMOVE,
      id: messageId
    }
    sendSocket(socketState.ws, send)
  }

  const readMessages = (roomId: string) => {
    sendSocket(socketState.ws, {
      cmd: TO_SERVER_CMD.ROOMS_READ,
      room: roomId
    })
  }

  const openRoom = (roomId: string) => {
    sendSocket(socketState.ws, {
      cmd: TO_SERVER_CMD.ROOMS_OPEN,
      roomId
    })
  }

  const closeRoom = (roomId: string) => {
    sendSocket(socketState.ws, {
      cmd: TO_SERVER_CMD.ROOMS_CLOSE,
      roomId
    })
  }

  const getHistory = (id: string, roomId: string) => {
    const message: ClientToSocketType = {
      cmd: TO_SERVER_CMD.MESSAGES_ROOM,
      room: roomId,
      id: id
    }
    sendSocket(socketState.ws, message)
  }

  const removeVoteAnswer = (messageId: string, index: number) => {
    sendSocket(socketState.ws, {
      cmd: TO_SERVER_CMD.VOTE_ANSWER_REMOVE,
      messageId: messageId,
      index: index
    })
  }

  const sendVoteAnswer = (messageId: string, index: number, answer: number) => {
    sendSocket(socketState.ws, {
      cmd: TO_SERVER_CMD.VOTE_ANSWER_SEND,
      messageId: messageId,
      index: index,
      answer: answer
    })
  }

  const updateRoomDescription = (roomId: string, description: string) => {
    sendSocket(socketState.ws, {
      cmd: TO_SERVER_CMD.ROOMS_UPDATE_DESCRIPTION,
      roomId,
      description
    })
  }

  return {
    state: {
      ws: socketState.ws
    },
    init,
    connect,
    getMessages: useCallback(getMessages, [socketState.ws]),
    getRooms: useCallback(getRooms, [socketState.ws]),
    sortRoom: useCallback(sortRoom, [socketState.ws]),
    incrementIine: useCallback(incrementIine, [socketState.ws]),
    sendMessage: useCallback(sendMessage, [socketState.ws]),
    sendModifyMessage: useCallback(sendModifyMessage, [socketState.ws]),
    sendDeleteMessage: useCallback(sendDeleteMessage, [socketState.ws]),
    enterRoom: useCallback(enterRoom, [socketState.ws]),
    readMessages: useCallback(readMessages, [socketState.ws]),
    openRoom: useCallback(openRoom, [socketState.ws]),
    closeRoom: useCallback(closeRoom, [socketState.ws]),
    getHistory: useCallback(getHistory, [socketState.ws]),
    removeVoteAnswer: useCallback(removeVoteAnswer, [socketState.ws]),
    sendVoteAnswer: useCallback(sendVoteAnswer, [socketState.ws]),
    updateRoomDescription: useCallback(updateRoomDescription, [socketState.ws])
  } as const
}
