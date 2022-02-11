import { useContext, useState, useMemo, useCallback } from 'react'
import { sendSocket } from '../../lib/util'
import {
  SendSocketCmd,
  SendSocketMessage,
  ReceiveSocketMessage
} from '../../type'
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

type FilterCmd<P extends ReceiveSocketMessage['cmd']> = Extract<
  ReceiveSocketMessage,
  { cmd: P }
>
type HandlerArgs<P extends ReceiveSocketMessage['cmd']> = {
  ws: WebSocket
  message: FilterCmd<P>
}
type MessageHandlers = {
  [P in ReceiveSocketMessage['cmd']]?: (args: HandlerArgs<P>) => void
}

type InitOptions = {
  url: string
  messageHandlers: MessageHandlers
}

export const useSocketForContext = () => {
  const [url, setUrl] = useState<string>('')
  const [ws, setWs] = useState<WebSocket>()
  const [reconnectTimer, setReconnectTimer] =
    useState<ReturnType<typeof setTimeout>>(null)
  const [reconnectInterval, setReconnectInterval] = useState<number>(
    INIT_RECONNECT_INTERVAL
  )
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0)
  const [reconnectCounter, setReconnectCounter] = useState<number>(0)
  const [messageHandlers, setMessageHandlers] = useState<MessageHandlers>()

  const state = useMemo(() => {
    return {
      ws
    }
  }, [ws])

  const init = (options: InitOptions) => {
    if (!options.url || options.url === '') {
      throw new Error('no url')
    }
    setUrl(options.url)
    connect(options.url, options.messageHandlers)
  }

  const close = useCallback(
    (socket: WebSocket) => {
      if (
        socket &&
        socket.readyState !== WebSocket.CLOSING &&
        socket.readyState !== WebSocket.CLOSED
      ) {
        // ws.close()
      }
      setWs(null)
    },
    [setWs]
  )

  const setOnMessageHandlers = useCallback(
    (ws: WebSocket, handlers: MessageHandlers) => {
      setMessageHandlers(handlers)
      ws.onmessage = (e: MessageEvent<any>): any => {
        if (!e) {
          return
        }
        if (e.data === 'ping') {
          ws.send('pong')
          return
        }
        try {
          const parsed: ReceiveSocketMessage = JSON.parse(e.data)
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
      if (ws) {
        return
      }

      const reconnect = () => {
        const counter = reconnectCounter + 1
        setReconnectCounter(counter)
        close(ws)
        if (counter >= MAX_RECONNECT) {
          if (reconnectTimer) {
            clearTimeout(reconnectTimer)
          }
          return
        }
        const timer = setTimeout(() => {
          connect(url, messageHandlers)
        }, reconnectInterval)

        const interval =
          reconnectInterval <= INIT_RECONNECT_INTERVAL
            ? DEFAULT_INTERVAL
            : reconnectInterval *
              Math.floor(Math.pow(RECONNECT_DECAY, reconnectAttempts))

        setReconnectTimer(timer)
        setReconnectInterval(interval)
      }

      const socketInstance = new WebSocket(connectUrl)
      setWs(socketInstance)

      socketInstance.addEventListener('open', () => {
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
        }
        setReconnectCounter(0)
        setReconnectTimer(null)
        setReconnectInterval(INIT_RECONNECT_INTERVAL)
        setReconnectAttempts(0)
      })

      setOnMessageHandlers(socketInstance, handlers)

      socketInstance.addEventListener('close', (e) => {
        console.log('ws close:', e)
        try {
          reconnect()
        } catch (err) {
          console.error(err)
        }
      })

      socketInstance.addEventListener('error', () => {
        close(socketInstance)
      })
    },
    [
      ws,
      setOnMessageHandlers,
      reconnectCounter,
      close,
      reconnectInterval,
      reconnectAttempts,
      reconnectTimer,
      url,
      messageHandlers
    ]
  )

  const getMessages = (roomId: string, socket?: WebSocket) => {
    const sendTo = socket ?? ws
    sendSocket(sendTo, {
      cmd: SendSocketCmd.MESSAGES_ROOM,
      room: roomId
    })
  }

  const getRooms = (socket?: WebSocket) => {
    const sendTo = socket ?? ws
    sendSocket(sendTo, { cmd: SendSocketCmd.ROOMS_GET })
  }

  const sortRoom = (roomOrder: string[]) => {
    sendSocket(ws, {
      cmd: SendSocketCmd.ROOMS_SORT,
      roomOrder
    })
  }

  const incrementIine = (messageId: string) => {
    sendSocket(ws, {
      cmd: SendSocketCmd.MESSAGE_IINE,
      id: messageId
    })
  }

  const sendMessage = (
    message: string,
    roomId: string,
    vote?: { questions: { text: string }[] }
  ) => {
    const send: SendSocketMessage = {
      cmd: SendSocketCmd.MESSAGE_SEND,
      message: message,
      room: roomId
    }
    if (vote) {
      send.vote = vote
    }
    sendSocket(ws, send)
  }

  const enterRoom = (roomName: string) => {
    sendSocket(ws, {
      cmd: SendSocketCmd.ROOMS_ENTER,
      name: encodeURIComponent(roomName)
    })
  }

  const sendModifyMessage = (message: string, messageId: string) => {
    const send: SendSocketMessage = {
      cmd: SendSocketCmd.MESSAGE_MODIFY,
      message: message,
      id: messageId
    }
    sendSocket(ws, send)
  }

  const readMessages = (roomId: string) => {
    sendSocket(ws, {
      cmd: SendSocketCmd.ROOMS_READ,
      room: roomId
    })
  }

  const openRoom = (roomId: string) => {
    sendSocket(ws, {
      cmd: SendSocketCmd.ROOMS_OPEN,
      roomId
    })
  }

  const closeRoom = (roomId: string) => {
    sendSocket(ws, {
      cmd: SendSocketCmd.ROOMS_CLOSE,
      roomId
    })
  }

  const getHistory = (id: string, roomId: string) => {
    const message: SendSocketMessage = {
      cmd: SendSocketCmd.MESSAGES_ROOM,
      room: roomId,
      id: id
    }
    sendSocket(ws, message)
  }

  const removeVoteAnswer = (messageId: string, index: number) => {
    sendSocket(ws, {
      cmd: SendSocketCmd.VOTE_ANSWER_REMOVE,
      messageId: messageId,
      index: index
    })
  }

  const sendVoteAnswer = (messageId: string, index: number, answer: number) => {
    sendSocket(ws, {
      cmd: SendSocketCmd.VOTE_ANSWER_SEND,
      messageId: messageId,
      index: index,
      answer: answer
    })
  }

  return {
    state,
    init: useCallback(init, [setUrl, connect]),
    setOnMessageHandlers,
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
