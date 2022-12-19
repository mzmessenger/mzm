import { useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { TO_CLIENT_CMD, TO_SERVER_CMD } from 'mzm-shared/type/socket'
import { useSocket } from './recoil/socket/hooks'
import { useUser, useUserAccountState } from './recoil/user/hooks'
import { useAuth } from './recoil/auth/hooks'
import { getRoomName } from './lib/util'
import { useUi } from './recoil/ui/hooks'
import { useRooms, useRoomActions } from './recoil/rooms/hooks'
import { useMessages } from './recoil/messages/hooks'
import { sendSocket } from './lib/util'

const useRouter = () => {
  const {
    state: { login }
  } = useAuth()
  const { getAccessToken } = useAuth()
  const { fetchMyInfo } = useUser()

  useEffect(() => {
    if (!login) {
      getAccessToken().then(({ accessToken }) => {
        if (accessToken) {
          fetchMyInfo()
        }
      })
    }
  }, [getAccessToken, fetchMyInfo, login])

  useEffect(() => {
    try {
      const room = getRoomName(location.pathname)

      if (room) {
        document.title = `MZM (${room})`
      } else {
        document.title = `MZM`
      }
    } catch (e) {
      console.error(e)
    }
  }, [])
}

const useResize = () => {
  const { onResize } = useUi()

  useEffect(() => {
    onResize(window.innerWidth, window.innerHeight)

    const handleResize = () => {
      onResize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [onResize])
}

const useWebSocket = (url: string) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const { fetchMyInfo } = useUser()
  const { userAccount } = useUserAccountState()
  const { init, getMessages, getRooms, readMessages } = useSocket()
  const { closeMenu } = useUi()
  const {
    addMessage,
    modifyMessage,
    removeMessage,
    addMessages,
    updateIine,
    setVoteAnswers
  } = useMessages()
  const { currentRoomId, currentRoomName } = useRooms()
  const {
    receiveRooms,
    receiveMessage,
    receiveMessages,
    reloadMessage,
    changeRoom,
    enterSuccess,
    alreadyRead,
    setRoomOrder,
    setRoomDescription
  } = useRoomActions()

  const messageHandlers: Parameters<typeof init>[0]['messageHandlers'] =
    useMemo(() => {
      return {
        [TO_CLIENT_CMD.SOCKET_CONNECTION]: ({ ws, message }) => {
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
        },
        [TO_CLIENT_CMD.ROOMS_GET]: ({ ws, message }) => {
          if (currentRoomId) {
            getMessages(currentRoomId, ws)
          }
          const gMessages = (roomId: string) => getMessages(roomId, ws)
          receiveRooms(
            message.rooms,
            message.roomOrder,
            currentRoomId,
            gMessages
          )
        },
        [TO_CLIENT_CMD.ROOMS_UPDATE_DESCRIPTION]: ({ ws, message }) => {
          setRoomDescription(message.roomId, message.descrioption)
        },
        [TO_CLIENT_CMD.MESSAGE_RECEIVE]: ({ message }) => {
          addMessage(message.message).then(() => {
            receiveMessage(
              message.message.id,
              message.message.message,
              message.room,
              userAccount,
              readMessages
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
        [TO_CLIENT_CMD.ROOMS_ENTER_SUCCESS]: ({ ws, message }) => {
          const currentPathRoomName = getRoomName(location.pathname)
          if (currentPathRoomName !== message.name) {
            navigate(`/rooms/${message.name}`)
            const gMesssages = (roomId: string) => getMessages(roomId, ws)
            changeRoom(message.id, gMesssages, closeMenu)
          }
          const gRooms = () => getRooms(ws)
          const gMesssages = (roomId: string) => getMessages(roomId, ws)
          enterSuccess(
            message.id,
            message.name,
            message.description,
            message.iconUrl,
            gRooms,
            gMesssages
          )
        },
        [TO_CLIENT_CMD.ROOMS_ENTER_FAIL]: () => {
          navigate('/')
          getRooms()
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
      }
    }, [
      userAccount,
      addMessage,
      addMessages,
      alreadyRead,
      changeRoom,
      closeMenu,
      currentRoomId,
      currentRoomName,
      enterSuccess,
      fetchMyInfo,
      getMessages,
      getRooms,
      location.pathname,
      modifyMessage,
      navigate,
      readMessages,
      receiveMessage,
      receiveMessages,
      receiveRooms,
      reloadMessage,
      removeMessage,
      setRoomDescription,
      setRoomOrder,
      setVoteAnswers,
      updateIine
    ])

  const options: Parameters<typeof init>[0] = useMemo(() => {
    return {
      url,
      messageHandlers
    }
  }, [url, messageHandlers])

  useEffect(() => {
    if (login) {
      init(options)
    }
  }, [login, init, options])
}

export const useApp = (url: string) => {
  useRouter()
  useResize()
  useWebSocket(url)
}
