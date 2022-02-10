import { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { store, State } from './modules/index'
import { useSocket, useDispatchSocket } from './contexts/socket/hooks'
import { useUser, useDispatchUser } from './contexts/user/hooks'
import { getRoomName } from './lib/util'
import { useDispatchUi } from './contexts/ui/hooks'
import {
  receiveRooms,
  receiveMessage,
  receiveMessages,
  enterSuccess,
  alreadyRead,
  reloadMessage,
  setRoomOrder,
  changeRoom,
  enterRoom
} from './modules/rooms'
import { useDispatchMessages } from './contexts/messages/hooks'
import { SendSocketCmd } from './type'
import { sendSocket } from './lib/util'

const useRouter = () => {
  const navigate = useNavigate()
  const { login, signup } = useUser()
  const { fetchMyInfo } = useDispatchUser()
  const { getMessages, enterRoom: enterRoomSocket } = useDispatchSocket()
  const { closeMenu } = useDispatchUi()
  const currentRoomName = useSelector((state: State) => {
    return state.rooms.currentRoomName
  })

  useEffect(() => {
    if (login && currentRoomName === '') {
      navigate('/')
    }
  }, [login, currentRoomName])

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
  }, [login, location.pathname])

  useEffect(() => {
    if (signup) {
      navigate('/signup')
    }
  }, [signup])
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
  }, [])
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

  const dispatch = useDispatch()
  const currentRoomName = useSelector((state: State) => {
    return state.rooms.currentRoomName
  })
  const currentRoomId = useSelector((state: State) => {
    return state.rooms.currentRoomId
  })

  useEffect(() => {
    if (!ws || !me) {
      return
    }
    setOnMessageHandlers(ws, messageHandlers)
  }, [ws, me, location])

  const messageHandlers: Parameters<typeof setOnMessageHandlers>[1] = {
    'socket:connection': ({ ws }) => {
      if (currentRoomName) {
        sendSocket(ws, {
          cmd: SendSocketCmd.ROOMS_ENTER,
          name: currentRoomName
        })
      } else {
        sendSocket(ws, { cmd: SendSocketCmd.ROOMS_GET })
      }
    },
    rooms: ({ ws, message }) => {
      if (currentRoomId) {
        getMessages(currentRoomId, ws)
      }
      const gMessages = (roomId: string) => getMessages(roomId, ws)
      receiveRooms(
        message.rooms,
        message.roomOrder,
        store.getState().rooms.currentRoomId,
        gMessages
      )(dispatch, store.getState)
    },
    'message:receive': ({ message }) => {
      console.log(me)
      addMessage(message.message).then(() => {
        receiveMessage(
          message.message.id,
          message.message.message,
          message.room,
          me,
          readMessages
        )(dispatch, store.getState)
      })
    },
    'message:modify': ({ message }) => {
      modifyMessage(message.message).then(() => {
        dispatch(reloadMessage(message.room))
      })
    },
    'messages:room': ({ message }) => {
      addMessages(message.messages).then(() => {
        receiveMessages({
          messageIds: message.messages.map((m) => m.id),
          room: message.room,
          existHistory: message.existHistory
        })(dispatch)
      })
    },
    'rooms:enter:success': ({ ws, message }) => {
      const currentPathRoomName = getRoomName(location.pathname)
      if (currentPathRoomName !== message.name) {
        navigate(`/rooms/${message.name}`)
        const gMesssages = (roomId: string) => getMessages(roomId, ws)
        changeRoom(message.id, gMesssages, closeMenu)(dispatch, store.getState)
      }
      const gRooms = () => getRooms(ws)
      const gMesssages = (roomId: string) => getMessages(roomId, ws)
      enterSuccess(
        message.id,
        message.name,
        message.iconUrl,
        gRooms,
        gMesssages
      )(dispatch, store.getState)
    },
    'rooms:enter:fail': () => {
      navigate('/')
      getRooms()
    },
    'rooms:read': ({ message }) => {
      dispatch(alreadyRead(message.room))
    },
    'message:iine': ({ message }) => {
      updateIine(message.id, message.iine)
      dispatch(reloadMessage(message.room))
    },
    'rooms:sort:success': ({ message }) => {
      setRoomOrder(message.roomOrder)(dispatch, store.getState)
    },
    'client:reload': () => {
      window.location.reload()
    },
    'vote:answers': ({ message }) => {
      setVoteAnswers(message.messageId, message.answers)
    }
  }

  const options: Parameters<typeof init>[0] = {
    url,
    messageHandlers
  }

  useEffect(() => {
    init(options)
  }, [])
}

export const useApp = (url: string) => {
  const { login } = useUser()

  useRouter()
  useResize()
  useWebSocket(url)

  return { login }
}
