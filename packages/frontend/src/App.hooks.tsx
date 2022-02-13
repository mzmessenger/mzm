import { useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { TO_CLIENT_CMD, TO_SERVER_CMD } from 'mzm-shared/type/socket'
import { useSocket, useDispatchSocket } from './contexts/socket/hooks'
import { useUser, useDispatchUser } from './contexts/user/hooks'
import { getRoomName } from './lib/util'
import { useDispatchUi } from './contexts/ui/hooks'
import { useRooms, useDispatchRooms } from './contexts/rooms/hooks'
import { useDispatchMessages } from './contexts/messages/hooks'
import { sendSocket } from './lib/util'

const useRouter = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, signup } = useUser()
  const { fetchMyInfo } = useDispatchUser()
  const { getMessages, enterRoom: enterRoomSocket } = useDispatchSocket()
  const { closeMenu } = useDispatchUi()
  const { currentRoomName } = useRooms()
  const { enterRoom } = useDispatchRooms()

  useEffect(() => {
    if (login && currentRoomName === '') {
      navigate('/')
    }
  }, [login, currentRoomName, navigate])

  useEffect(() => {
    const room = location.pathname.match(/\/rooms\/(.+)/) && RegExp.$1
    if (!login && (location.pathname === '/' || room)) {
      fetchMyInfo()
    }

    if (login && room) {
      enterRoom(room, getMessages, enterRoomSocket, closeMenu)
    }

    if (room) {
      document.title = `MZM (${room})`
    } else {
      document.title = `MZM`
    }
  }, [
    login,
    location.pathname,
    fetchMyInfo,
    enterRoom,
    getMessages,
    enterRoomSocket,
    closeMenu
  ])

  useEffect(() => {
    if (signup) {
      navigate('/signup')
    }
  }, [signup, navigate])
}

const useResize = () => {
  const { onResize } = useDispatchUi()

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
  const { me } = useUser()
  const { ws } = useSocket()
  const { init, setOnMessageHandlers, getMessages, getRooms, readMessages } =
    useDispatchSocket()
  const { closeMenu } = useDispatchUi()
  const { addMessage, modifyMessage, addMessages, updateIine, setVoteAnswers } =
    useDispatchMessages()
  const { currentRoomId, currentRoomName } = useRooms()
  const {
    receiveRooms,
    receiveMessage,
    receiveMessages,
    reloadMessage,
    changeRoom,
    enterSuccess,
    alreadyRead,
    setRoomOrder
  } = useDispatchRooms()

  const messageHandlers: Parameters<typeof setOnMessageHandlers>[1] =
    useMemo(() => {
      return {
        [TO_CLIENT_CMD.SOCKET_CONNECTION]: ({ ws }) => {
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
        [TO_CLIENT_CMD.MESSAGE_RECEIVE]: ({ message }) => {
          addMessage(message.message).then(() => {
            receiveMessage(
              message.message.id,
              message.message.message,
              message.room,
              me,
              readMessages
            )
          })
        },
        [TO_CLIENT_CMD.MESSAGE_MODIFY]: ({ message }) => {
          modifyMessage(message.message).then(() => {
            reloadMessage(message.room)
          })
        },
        [TO_CLIENT_CMD.MESSAGES_ROOM]: ({ message }) => {
          addMessages(message.messages).then(() => {
            receiveMessages({
              messageIds: message.messages.map((m) => m.id),
              room: message.room,
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
      addMessage,
      addMessages,
      alreadyRead,
      changeRoom,
      closeMenu,
      currentRoomId,
      currentRoomName,
      enterSuccess,
      getMessages,
      getRooms,
      location.pathname,
      me,
      modifyMessage,
      navigate,
      readMessages,
      receiveMessage,
      receiveMessages,
      receiveRooms,
      reloadMessage,
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
    init(options)
  }, [init, options])
}

export const useApp = (url: string) => {
  const { login } = useUser()

  useRouter()
  useResize()
  useWebSocket(url)

  return { login }
}
