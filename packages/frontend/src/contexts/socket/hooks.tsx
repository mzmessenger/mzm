import { useContext, useState } from 'react'
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
  INIT_RECONNECT_INTERVAL
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
  const [messageHandlers, setMessageHandlers] = useState<MessageHandlers>()

  const init = (options: InitOptions) => {
    if (!options.url || options.url === '') {
      throw new Error('no url')
    }
    setUrl(options.url)
    connect(options.url, options.messageHandlers)
  }

  const close = () => {
    if (
      ws &&
      ws.readyState !== WebSocket.CLOSING &&
      ws.readyState !== WebSocket.CLOSED
    ) {
      // ws.close()
    }
    setWs(null)
  }

  const reconnect = (e: CloseEvent) => {
    close()
    // @todo max recoonect
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

  const setOnMessageHandlers = (ws: WebSocket, handlers: MessageHandlers) => {
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
  }

  const connect = (connectUrl: string, handlers: MessageHandlers) => {
    if (ws) {
      return
    }
    const socketInstance = new WebSocket(connectUrl)
    setWs(socketInstance)

    socketInstance.addEventListener('open', () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
      }
      setReconnectTimer(null)
      setReconnectInterval(INIT_RECONNECT_INTERVAL)
      setReconnectAttempts(0)
    })

    setOnMessageHandlers(socketInstance, handlers)

    socketInstance.addEventListener('close', (e) => {
      console.log('ws close:', e)
      try {
        reconnect(e)
      } catch (err) {
        console.error(err)
      }
    })

    socketInstance.addEventListener('error', () => {
      close()
    })
  }

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
    state: {
      ws
    },
    init,
    setOnMessageHandlers,
    connect,
    reconnect,
    getMessages,
    getRooms,
    sortRoom,
    incrementIine,
    sendMessage,
    sendModifyMessage,
    enterRoom,
    readMessages,
    openRoom,
    closeRoom,
    getHistory,
    removeVoteAnswer,
    sendVoteAnswer
  } as const
}
