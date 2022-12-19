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

const socketState = atom<SocketState>({
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

const socketRecoonectState = atom<SocketRecoonectState>({
  key: 'state:socket:reconnect',
  default: {
    reconnectInterval: INIT_RECONNECT_INTERVAL,
    reconnectAttempts: 0
  }
})

export const useSocket = () => {
  const { getAccessToken } = useAuth()
  const [socket, setSocket] = useRecoilState(socketState)
  const [socketRecoonect, setSocketRecoonect] =
    useRecoilState(socketRecoonectState)

  const close = useCallback((socket: WebSocket) => {
    if (
      socket &&
      socket.readyState !== WebSocket.CLOSING &&
      socket.readyState !== WebSocket.CLOSED
    ) {
      socket.close()
    }
  }, [])

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
      if (socket.ws || socket.connecting) {
        return
      }

      setSocket((current) => {
        return { ...current, connecting: true }
      })
      const { accessToken } = await getAccessToken()
      const socketInstance = new WebSocket(connectUrl + `?token=${accessToken}`)

      setSocket((current) => {
        return { ...current, ws: socketInstance }
      })

      socketInstance.addEventListener('open', () => {
        console.log('ws open')
        setSocket((current) => {
          return {
            ...current,
            connecting: false
          }
        })
        setSocketRecoonect({
          reconnectInterval: INIT_RECONNECT_INTERVAL,
          reconnectAttempts: 0
        })
      })

      setOnMessageHandlers(socketInstance, handlers)

      const reconnect = async () => {
        const counter = socketRecoonect.reconnectAttempts + 1
        setSocketRecoonect((current) => {
          return {
            ...current,
            reconnectAttempts: counter
          }
        })

        if (counter >= MAX_RECONNECT) {
          return
        }

        console.warn(
          `ws reconnect: ${socketRecoonect.reconnectAttempts} `,
          dayjs().format('YYYY/MM/DD HH:mm:ss'),
          socketRecoonect.reconnectInterval
        )

        await sleep(socketRecoonect.reconnectInterval)
        connect(connectUrl, handlers)

        const newInterval =
          socketRecoonect.reconnectInterval <= INIT_RECONNECT_INTERVAL
            ? DEFAULT_INTERVAL
            : socketRecoonect.reconnectInterval *
              Math.floor(
                Math.pow(RECONNECT_DECAY, socketRecoonect.reconnectAttempts)
              )

        setSocketRecoonect((current) => {
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
      setSocketRecoonect,
      setSocket,
      socketRecoonect.reconnectAttempts,
      socketRecoonect.reconnectInterval,
      socket.connecting,
      socket.ws
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

  const getMessages = useCallback(
    (roomId: string, s?: WebSocket) => {
      const sendTo = s ?? socket.ws
      sendSocket(sendTo, {
        cmd: TO_SERVER_CMD.MESSAGES_ROOM,
        room: roomId
      })
    },
    [socket.ws]
  )

  const getRooms = useCallback(
    (s?: WebSocket) => {
      const sendTo = s ?? socket.ws
      sendSocket(sendTo, { cmd: TO_SERVER_CMD.ROOMS_GET })
    },
    [socket.ws]
  )

  const sortRoom = useCallback(
    (roomOrder: string[]) => {
      sendSocket(socket.ws, {
        cmd: TO_SERVER_CMD.ROOMS_SORT,
        roomOrder
      })
    },
    [socket.ws]
  )

  const incrementIine = useCallback(
    (messageId: string) => {
      sendSocket(socket.ws, {
        cmd: TO_SERVER_CMD.MESSAGE_IINE,
        id: messageId
      })
    },
    [socket.ws]
  )

  const sendMessage = useCallback(
    (
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
      sendSocket(socket.ws, send)
    },
    [socket.ws]
  )

  const enterRoom = useCallback(
    (roomName: string) => {
      sendSocket(socket.ws, {
        cmd: TO_SERVER_CMD.ROOMS_ENTER,
        name: encodeURIComponent(roomName)
      })
    },
    [socket.ws]
  )

  const sendModifyMessage = useCallback(
    (message: string, messageId: string) => {
      const send: ClientToSocketType = {
        cmd: TO_SERVER_CMD.MESSAGE_MODIFY,
        message: message,
        id: messageId
      }
      sendSocket(socket.ws, send)
    },
    [socket.ws]
  )

  const sendDeleteMessage = useCallback(
    (messageId: string) => {
      const send: ClientToSocketType = {
        cmd: TO_SERVER_CMD.MESSAGE_REMOVE,
        id: messageId
      }
      sendSocket(socket.ws, send)
    },
    [socket.ws]
  )

  const readMessages = useCallback(
    (roomId: string) => {
      sendSocket(socket.ws, {
        cmd: TO_SERVER_CMD.ROOMS_READ,
        room: roomId
      })
    },
    [socket.ws]
  )

  const openRoom = useCallback(
    (roomId: string) => {
      sendSocket(socket.ws, {
        cmd: TO_SERVER_CMD.ROOMS_OPEN,
        roomId
      })
    },
    [socket.ws]
  )

  const closeRoom = useCallback(
    (roomId: string) => {
      sendSocket(socket.ws, {
        cmd: TO_SERVER_CMD.ROOMS_CLOSE,
        roomId
      })
    },
    [socket.ws]
  )

  const getHistory = useCallback(
    (id: string, roomId: string) => {
      const message: ClientToSocketType = {
        cmd: TO_SERVER_CMD.MESSAGES_ROOM,
        room: roomId,
        id: id
      }
      sendSocket(socket.ws, message)
    },
    [socket.ws]
  )

  const removeVoteAnswer = useCallback(
    (messageId: string, index: number) => {
      sendSocket(socket.ws, {
        cmd: TO_SERVER_CMD.VOTE_ANSWER_REMOVE,
        messageId: messageId,
        index: index
      })
    },
    [socket.ws]
  )

  const sendVoteAnswer = useCallback(
    (messageId: string, index: number, answer: number) => {
      sendSocket(socket.ws, {
        cmd: TO_SERVER_CMD.VOTE_ANSWER_SEND,
        messageId: messageId,
        index: index,
        answer: answer
      })
    },
    [socket.ws]
  )

  const updateRoomDescription = useCallback(
    (roomId: string, description: string) => {
      sendSocket(socket.ws, {
        cmd: TO_SERVER_CMD.ROOMS_UPDATE_DESCRIPTION,
        roomId,
        description
      })
    },
    [socket.ws]
  )

  return {
    state: {
      ws: socket.ws
    },
    init,
    connect,
    getMessages,
    getRooms,
    sortRoom,
    incrementIine,
    sendMessage,
    sendModifyMessage,
    sendDeleteMessage,
    enterRoom,
    readMessages,
    openRoom,
    closeRoom,
    getHistory,
    removeVoteAnswer,
    sendVoteAnswer,
    updateRoomDescription
  } as const
}
