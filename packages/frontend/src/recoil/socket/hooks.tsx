import type { useAuth } from '../auth/hooks'
import type { useUserAccount } from '../user/hooks'
import { useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef } from 'react'
import {
  ClientToSocketType,
  TO_CLIENT_CMD,
  TO_SERVER_CMD,
  ToClientType,
  FilterToClientType
} from 'mzm-shared/type/socket'
import { useRoomActionsForSocket } from '../rooms/hooks'
import { useMessagesForSocket } from '../messages/hooks'
import { useMyInfoActions } from '../user/hooks'
import { useUiActions } from '../ui/hooks'
import { atom, useRecoilState, useRecoilValue } from 'recoil'
import dayjs from 'dayjs'
import { sendSocket, getRoomName } from '../../lib/util'
import { logger } from '../../lib/logger'

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
}

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const sharedActions = {
  readMessages: (roomId: string, socket: WebSocket) => {
    sendSocket(socket, {
      cmd: TO_SERVER_CMD.ROOMS_READ,
      room: roomId
    })
  },
  getMessages: (roomId: string, socket: WebSocket) => {
    const sendTo = socket
    sendSocket(sendTo, {
      cmd: TO_SERVER_CMD.MESSAGES_ROOM,
      room: roomId
    })
  },
  getRooms: (socket: WebSocket) => {
    const sendTo = socket
    sendSocket(sendTo, { cmd: TO_SERVER_CMD.ROOMS_GET })
  }
} as const

export const useSocketActions = () => {
  const socket = useRecoilValue(socketState)

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

  const getMessages = useCallback(
    (roomId: string) => {
      sharedActions.getMessages(roomId, socket.ws)
    },
    [socket.ws]
  )

  const getRooms = useCallback(() => {
    sharedActions.getRooms(socket.ws), [socket.ws]
  }, [socket.ws])

  const readMessages = useCallback(
    (roomId: string) => {
      sharedActions.readMessages(roomId, socket.ws)
    },
    [socket.ws]
  )

  return {
    sortRoom,
    incrementIine,
    sendMessage,
    sendModifyMessage,
    sendDeleteMessage,
    enterRoom,
    openRoom,
    closeRoom,
    getHistory,
    removeVoteAnswer,
    sendVoteAnswer,
    updateRoomDescription,
    getMessages,
    getRooms,
    readMessages
  } as const
}

export const useSocket = ({
  pathname,
  userAccount,
  getAccessToken,
  logout
}: {
  pathname: string
  userAccount: ReturnType<typeof useUserAccount>['userAccount']
  getAccessToken: ReturnType<typeof useAuth>['getAccessToken']
  logout: ReturnType<typeof useAuth>['logout']
}) => {
  const navigate = useNavigate()
  const handlers = useRef<MessageHandlers>({})
  const [socket, setSocket] = useRecoilState(socketState)
  const [socketRecoonect, setSocketRecoonect] =
    useRecoilState(socketRecoonectState)
  const {
    addMessage,
    modifyMessage,
    removeMessage,
    addMessages,
    updateIine,
    setVoteAnswers
  } = useMessagesForSocket()
  const {
    currentRoomId,
    currentRoomName,
    enterSuccess,
    alreadyRead,
    reloadMessage,
    setRoomOrder,
    receiveMessages,
    receiveMessage,
    receiveRooms,
    setRoomDescription,
    changeRoom
  } = useRoomActionsForSocket()
  const { closeMenu } = useUiActions()
  const { fetchMyInfo } = useMyInfoActions({ getAccessToken, logout })

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.SOCKET_CONNECTION] = ({ ws, message }) => {
      if (message.signup) {
        fetchMyInfo()
      }
      if (currentRoomName) {
        sendSocket(ws, {
          cmd: TO_SERVER_CMD.ROOMS_ENTER,
          name: currentRoomName
        })
      } else {
        sendSocket(ws, { cmd: TO_SERVER_CMD.ROOMS_GET })
      }
    }
  }, [currentRoomName, fetchMyInfo])

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.ROOMS_GET] = ({ ws, message }) => {
      receiveRooms(message.rooms, message.roomOrder, currentRoomId, {
        getMessages: (currentRoomId) =>
          sharedActions.getMessages(currentRoomId, ws)
      })
    }
  }, [currentRoomId, receiveRooms])

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.ROOMS_UPDATE_DESCRIPTION] = ({
      message
    }) => {
      setRoomDescription(message.roomId, message.descrioption)
    }
  }, [setRoomDescription])

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.MESSAGE_RECEIVE] = ({ ws, message }) => {
      addMessage(message.message).then(() => {
        receiveMessage(
          message.message.id,
          message.message.message,
          message.room,
          userAccount,
          {
            readMessages: (roomId) => sharedActions.readMessages(roomId, ws)
          }
        )
      })
    }
  }, [addMessage, receiveMessage, userAccount])

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.MESSAGE_MODIFY] = ({ message }) => {
      modifyMessage(message.message).then(() => {
        reloadMessage(message.room)
      })
    }
  }, [modifyMessage, reloadMessage])

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.MESSAGE_REMOVE] = ({ message }) => {
      removeMessage(message.message).then(() => {
        reloadMessage(message.room)
      })
    }
  }, [reloadMessage, removeMessage])

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.MESSAGES_ROOM] = ({ message }) => {
      addMessages(message.messages).then(() => {
        receiveMessages({
          messageIds: message.messages.map((m) => m.id),
          roomId: message.room,
          existHistory: message.existHistory
        })
      })
    }
  }, [addMessages, receiveMessages])

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.ROOMS_ENTER_SUCCESS] = ({ ws, message }) => {
      const currentPathRoomName = getRoomName(pathname)
      if (currentPathRoomName !== message.name) {
        navigate(`/rooms/${message.name}`)
        changeRoom(message.id, {
          getMessages: (roomId) => sharedActions.getMessages(roomId, ws),
          closeMenu
        })
      }
      enterSuccess(
        message.id,
        message.name,
        message.description,
        message.iconUrl,
        {
          getMessages: (roomId) => sharedActions.getMessages(roomId, ws),
          getRooms: () => sharedActions.getRooms(ws)
        }
      )
    }
  }, [changeRoom, closeMenu, enterSuccess, navigate, pathname])

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.ROOMS_ENTER_SUCCESS] = ({ ws, message }) => {
      const currentPathRoomName = getRoomName(pathname)
      if (currentPathRoomName !== message.name) {
        navigate(`/rooms/${message.name}`)
        changeRoom(message.id, {
          getMessages: (roomId) => sharedActions.getMessages(roomId, ws),
          closeMenu
        })
      }
      enterSuccess(
        message.id,
        message.name,
        message.description,
        message.iconUrl,
        {
          getMessages: (roomId) => sharedActions.getMessages(roomId, ws),
          getRooms: () => sharedActions.getRooms(ws)
        }
      )
    }
  }, [changeRoom, closeMenu, enterSuccess, navigate, pathname])

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.ROOMS_ENTER_FAIL] = ({ ws }) => {
      navigate('/')
      sharedActions.getRooms(ws)
    }
  }, [navigate])

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.ROOMS_READ] = ({ message }) => {
      alreadyRead(message.room)
    }
  }, [alreadyRead])

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.MESSAGE_IINE] = ({ message }) => {
      updateIine(message.id, message.iine)
      reloadMessage(message.room)
    }
  }, [reloadMessage, updateIine])

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.ROOMS_SORT_SUCCESS] = ({ message }) => {
      setRoomOrder(message.roomOrder)
    }
  }, [setRoomOrder])

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.VOTE_ANSWERS] = ({ message }) => {
      setVoteAnswers(message.messageId, message.answers)
    }
  }, [setVoteAnswers])

  useEffect(() => {
    handlers.current[TO_CLIENT_CMD.CLIENT_RELOAD] = () => {
      window.location.reload()
    }
  }, [])

  const close = useCallback((socket: WebSocket) => {
    if (
      socket &&
      socket.readyState !== WebSocket.CLOSING &&
      socket.readyState !== WebSocket.CLOSED
    ) {
      socket.close()
    }
  }, [])

  const connect = useCallback(
    async (connectUrl: string) => {
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
        logger.log('ws open')
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

      socketInstance.onmessage = (e) => {
        if (!e) {
          return
        }
        if (e.data === 'ping') {
          socketInstance.send('pong')
          return
        }
        try {
          const parsed: ToClientType = JSON.parse(e.data)
          if (handlers.current[parsed.cmd]) {
            const handler = handlers.current[parsed.cmd]
            const args: HandlerArgs<typeof parsed.cmd> = {
              ws: socketInstance,
              message: parsed
            }
            // @todo remove any
            handler(args as any)
          }
        } catch (err) {
          logger.error(err)
        }
      }

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

        logger.warn(
          `ws reconnect: ${socketRecoonect.reconnectAttempts} `,
          dayjs().format('YYYY/MM/DD HH:mm:ss'),
          socketRecoonect.reconnectInterval
        )

        await sleep(socketRecoonect.reconnectInterval)
        connect(connectUrl)

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
        logger.warn('ws close:', e)
        try {
          close(socketInstance)
          reconnect()
        } catch (err) {
          logger.error(err)
        }
      })

      socketInstance.addEventListener('error', (e) => {
        logger.warn('ws error:', e)
        try {
          close(socketInstance)
          reconnect()
        } catch (err) {
          logger.error(err)
        }
      })
    },
    [
      socket.ws,
      socket.connecting,
      setSocket,
      getAccessToken,
      setSocketRecoonect,
      socketRecoonect.reconnectAttempts,
      socketRecoonect.reconnectInterval,
      close
    ]
  )

  const init = useCallback(
    (options: InitOptions) => {
      if (!options.url || options.url === '') {
        throw new Error('no url')
      }

      connect(options.url)
    },
    [connect]
  )

  return {
    state: {
      ws: socket.ws
    },
    init,
    connect
  } as const
}
