import { useContext, useCallback, useRef } from 'react'
import dayjs from 'dayjs'
import {
  ClientToSocketType,
  TO_SERVER_CMD,
  ToClientType,
  FilterToClientType
} from 'mzm-shared/type/socket'
import { sendSocket } from '../../lib/util'
import { SocketContext, SocketDispatchContext } from './index'
import {
  DEFAULT_INTERVAL,
  RECONNECT_DECAY,
  INIT_RECONNECT_INTERVAL,
  MAX_RECONNECT
} from './constants'

export const useSocket = () => {
  return useContext(SocketContext)
}

export const useDispatchSocket = () => {
  return useContext(SocketDispatchContext)
}

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

export const useSocketForContext = () => {
  const ws = useRef<WebSocket>(null)
  const reconnectInterval = useRef<number>(INIT_RECONNECT_INTERVAL)
  const reconnectAttempts = useRef<number>(0)

  const init = (options: InitOptions) => {
    if (!options.url || options.url === '') {
      throw new Error('no url')
    }
    connect(options.url, options.messageHandlers)
  }

  const close = useCallback((socket: WebSocket) => {
    if (
      socket &&
      socket.readyState !== WebSocket.CLOSING &&
      socket.readyState !== WebSocket.CLOSED
    ) {
      ws.current.close()
    }
    ws.current = null
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
    (connectUrl: string, handlers: MessageHandlers) => {
      if (ws.current) {
        return
      }

      const reconnect = async () => {
        const counter = reconnectAttempts.current + 1
        reconnectAttempts.current = counter
        if (counter >= MAX_RECONNECT) {
          return
        }

        console.warn(
          `ws reconnect: ${reconnectAttempts.current} `,
          dayjs().format('YYYY/MM/DD HH:mm:ss'),
          reconnectInterval.current
        )

        await sleep(reconnectInterval.current)
        connect(connectUrl, handlers)

        const newInterval =
          reconnectInterval.current <= INIT_RECONNECT_INTERVAL
            ? DEFAULT_INTERVAL
            : reconnectInterval.current *
              Math.floor(Math.pow(RECONNECT_DECAY, reconnectAttempts.current))

        reconnectInterval.current = newInterval
      }

      const socketInstance = new WebSocket(connectUrl)
      ws.current = socketInstance

      socketInstance.addEventListener('open', () => {
        console.log('ws open')
        reconnectInterval.current = INIT_RECONNECT_INTERVAL
        reconnectAttempts.current = 0
      })

      setOnMessageHandlers(socketInstance, handlers)

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
        close(socketInstance)
        try {
          close(socketInstance)
          reconnect()
        } catch (err) {
          console.error(err)
        }
      })
    },
    [ws, setOnMessageHandlers, close]
  )

  const getMessages = (roomId: string, socket?: WebSocket) => {
    const sendTo = socket ?? ws.current
    sendSocket(sendTo, {
      cmd: TO_SERVER_CMD.MESSAGES_ROOM,
      room: roomId
    })
  }

  const getRooms = (socket?: WebSocket) => {
    const sendTo = socket ?? ws.current
    sendSocket(sendTo, { cmd: TO_SERVER_CMD.ROOMS_GET })
  }

  const sortRoom = (roomOrder: string[]) => {
    sendSocket(ws.current, {
      cmd: TO_SERVER_CMD.ROOMS_SORT,
      roomOrder
    })
  }

  const incrementIine = (messageId: string) => {
    sendSocket(ws.current, {
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
    sendSocket(ws.current, send)
  }

  const enterRoom = (roomName: string) => {
    sendSocket(ws.current, {
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
    sendSocket(ws.current, send)
  }

  const readMessages = (roomId: string) => {
    sendSocket(ws.current, {
      cmd: TO_SERVER_CMD.ROOMS_READ,
      room: roomId
    })
  }

  const openRoom = (roomId: string) => {
    sendSocket(ws.current, {
      cmd: TO_SERVER_CMD.ROOMS_OPEN,
      roomId
    })
  }

  const closeRoom = (roomId: string) => {
    sendSocket(ws.current, {
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
    sendSocket(ws.current, message)
  }

  const removeVoteAnswer = (messageId: string, index: number) => {
    sendSocket(ws.current, {
      cmd: TO_SERVER_CMD.VOTE_ANSWER_REMOVE,
      messageId: messageId,
      index: index
    })
  }

  const sendVoteAnswer = (messageId: string, index: number, answer: number) => {
    sendSocket(ws.current, {
      cmd: TO_SERVER_CMD.VOTE_ANSWER_SEND,
      messageId: messageId,
      index: index,
      answer: answer
    })
  }

  return {
    state: {
      ws: ws.current
    },
    init: useCallback(init, [connect]),
    connect,
    getMessages: useCallback(getMessages, [ws]),
    getRooms: useCallback(getRooms, [ws]),
    sortRoom: useCallback(sortRoom, [ws]),
    incrementIine: useCallback(incrementIine, [ws]),
    sendMessage: useCallback(sendMessage, [ws]),
    sendModifyMessage: useCallback(sendModifyMessage, [ws]),
    enterRoom: useCallback(enterRoom, [ws]),
    readMessages: useCallback(readMessages, [ws]),
    openRoom: useCallback(openRoom, [ws]),
    closeRoom: useCallback(closeRoom, [ws]),
    getHistory: useCallback(getHistory, [ws]),
    removeVoteAnswer: useCallback(removeVoteAnswer, [ws]),
    sendVoteAnswer: useCallback(sendVoteAnswer, [ws])
  } as const
}
