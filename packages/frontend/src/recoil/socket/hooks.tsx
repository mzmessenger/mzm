import { useNavigate } from 'react-router-dom'
import { useCallback } from 'react'
import {
  ClientToSocketType,
  TO_CLIENT_CMD,
  TO_SERVER_CMD,
  ToClientType,
  FilterToClientType
} from 'mzm-shared/src/type/socket'
import { useRoomActionsForSocket } from '../rooms/hooks'
import { useMessagesForSocket } from '../messages/hooks'
import { useMyInfoActions, useUserAccount } from '../user/hooks'
import { useUiActions } from '../ui/hooks'
import { getRoomName } from '../../lib/util'
import { sendSocket } from '../../lib/client'

type HandlerArgs<P extends ToClientType['cmd']> = {
  message: FilterToClientType<P>
}
type MessageHandlers = {
  [P in ToClientType['cmd']]?: (args: HandlerArgs<P>) => void
}

const sharedActions = {
  readMessages: (roomId: string) => {
    sendSocket({
      cmd: TO_SERVER_CMD.ROOMS_READ,
      room: roomId
    })
  },
  getMessages: (roomId: string) => {
    sendSocket({
      cmd: TO_SERVER_CMD.MESSAGES_ROOM,
      room: roomId
    })
  },
  getRooms: () => {
    sendSocket({ cmd: TO_SERVER_CMD.ROOMS_GET })
  }
} as const

export const useSocketActions = () => {
  const sortRoom = useCallback((roomOrder: string[]) => {
    sendSocket({
      cmd: TO_SERVER_CMD.ROOMS_SORT,
      roomOrder
    })
  }, [])

  const incrementIine = useCallback((messageId: string) => {
    sendSocket({
      cmd: TO_SERVER_CMD.MESSAGE_IINE,
      id: messageId
    })
  }, [])

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
      sendSocket(send)
    },
    []
  )

  const enterRoom = useCallback((roomName: string) => {
    sendSocket({
      cmd: TO_SERVER_CMD.ROOMS_ENTER,
      name: encodeURIComponent(roomName)
    })
  }, [])

  const sendModifyMessage = useCallback(
    (message: string, messageId: string) => {
      const send: ClientToSocketType = {
        cmd: TO_SERVER_CMD.MESSAGE_MODIFY,
        message: message,
        id: messageId
      }
      sendSocket(send)
    },
    []
  )

  const sendDeleteMessage = useCallback((messageId: string) => {
    const send: ClientToSocketType = {
      cmd: TO_SERVER_CMD.MESSAGE_REMOVE,
      id: messageId
    }
    sendSocket(send)
  }, [])

  const openRoom = useCallback((roomId: string) => {
    sendSocket({
      cmd: TO_SERVER_CMD.ROOMS_OPEN,
      roomId
    })
  }, [])

  const closeRoom = useCallback((roomId: string) => {
    sendSocket({
      cmd: TO_SERVER_CMD.ROOMS_CLOSE,
      roomId
    })
  }, [])

  const getHistory = useCallback((id: string, roomId: string) => {
    const message: ClientToSocketType = {
      cmd: TO_SERVER_CMD.MESSAGES_ROOM,
      room: roomId,
      id: id
    }
    sendSocket(message)
  }, [])

  const removeVoteAnswer = useCallback((messageId: string, index: number) => {
    sendSocket({
      cmd: TO_SERVER_CMD.VOTE_ANSWER_REMOVE,
      messageId: messageId,
      index: index
    })
  }, [])

  const sendVoteAnswer = useCallback(
    (messageId: string, index: number, answer: number) => {
      sendSocket({
        cmd: TO_SERVER_CMD.VOTE_ANSWER_SEND,
        messageId: messageId,
        index: index,
        answer: answer
      })
    },
    []
  )

  const updateRoomDescription = useCallback(
    (roomId: string, description: string) => {
      sendSocket({
        cmd: TO_SERVER_CMD.ROOMS_UPDATE_DESCRIPTION,
        roomId,
        description
      })
    },
    []
  )

  const getMessages = useCallback((roomId: string) => {
    sharedActions.getMessages(roomId)
  }, [])

  const getRooms = useCallback(() => {
    sharedActions.getRooms()
  }, [])

  const readMessages = useCallback((roomId: string) => {
    sharedActions.readMessages(roomId)
  }, [])

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

export const useMessageListener = (props: { pathname: string }) => {
  const navigate = useNavigate()
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
  const { fetchMyInfo } = useMyInfoActions()
  const { userAccount } = useUserAccount()

  const handlers: MessageHandlers = {
    [TO_CLIENT_CMD.SOCKET_CONNECTION]: ({ message }) => {
      if (message.signup) {
        fetchMyInfo()
      }
      if (currentRoomName) {
        sendSocket({
          cmd: TO_SERVER_CMD.ROOMS_ENTER,
          name: currentRoomName
        })
      } else {
        sendSocket({ cmd: TO_SERVER_CMD.ROOMS_GET })
      }
    },
    [TO_CLIENT_CMD.ROOMS_GET]: ({ message }) => {
      receiveRooms(message.rooms, message.roomOrder, currentRoomId, {
        getMessages: (currentRoomId) => sharedActions.getMessages(currentRoomId)
      })
    },
    [TO_CLIENT_CMD.ROOMS_UPDATE_DESCRIPTION]: ({ message }) => {
      setRoomDescription(message.roomId, message.descrioption)
    },
    [TO_CLIENT_CMD.MESSAGE_RECEIVE]: ({ message }) => {
      addMessage(message.message).then(() => {
        receiveMessage(
          message.message.id,
          message.message.message,
          message.room,
          userAccount,
          {
            readMessages: (roomId) => sharedActions.readMessages(roomId)
          }
        )
      })
    },
    [TO_CLIENT_CMD.MESSAGE_MODIFY]: ({ message }) => {
      modifyMessage(message.message).then(() => {
        reloadMessage(message.room)
      })
    },
    [TO_CLIENT_CMD.MESSAGE_REMOVE]: ({ message }) => {
      removeMessage(message.message).then(() => {
        reloadMessage(message.room)
      })
    },
    [TO_CLIENT_CMD.MESSAGES_ROOM]: ({ message }) => {
      addMessages(message.messages).then(() => {
        receiveMessages({
          messageIds: message.messages.map((m) => m.id),
          roomId: message.room,
          existHistory: message.existHistory
        })
      })
    },
    [TO_CLIENT_CMD.ROOMS_ENTER_SUCCESS]: ({ message }) => {
      const currentPathRoomName = getRoomName(props.pathname)
      if (currentPathRoomName !== message.name) {
        navigate(`/rooms/${message.name}`)
        changeRoom(message.id, {
          getMessages: (roomId) => sharedActions.getMessages(roomId),
          closeMenu
        })
      }
      enterSuccess(
        message.id,
        message.name,
        message.description,
        message.iconUrl,
        {
          getMessages: (roomId) => sharedActions.getMessages(roomId),
          getRooms: () => sharedActions.getRooms()
        }
      )
    },
    [TO_CLIENT_CMD.ROOMS_ENTER_FAIL]: () => {
      navigate('/')
      sharedActions.getRooms()
    },
    [TO_CLIENT_CMD.ROOMS_READ]: ({ message }) => {
      alreadyRead(message.room)
    },
    [TO_CLIENT_CMD.MESSAGE_IINE]: ({ message }) => {
      updateIine(message.id, message.iine)
      reloadMessage(message.room)
    },
    [TO_CLIENT_CMD.ROOMS_SORT_SUCCESS]: ({ message }) => {
      setRoomOrder(message.roomOrder)
    },
    [TO_CLIENT_CMD.VOTE_ANSWERS]: ({ message }) => {
      setVoteAnswers(message.messageId, message.answers)
    },
    [TO_CLIENT_CMD.CLIENT_RELOAD]: () => {
      window.location.reload()
    }
  } as const

  return { handlers } as const
}
