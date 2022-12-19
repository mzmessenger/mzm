import { useCallback } from 'react'
import { atom, useRecoilState } from 'recoil'
import { FilterToClientType, TO_CLIENT_CMD } from 'mzm-shared/type/socket'
import type { RESPONSE, REQUEST } from 'mzm-shared/type/api'
import type { useSocket } from '../../recoil/socket/hooks'
import type { useUi } from '../../recoil/ui/hooks'
import { useAuth } from '../../recoil/auth/hooks'
import { createApiClient } from '../../lib/client'
import { isReplied } from '../../lib/util'

type RoomUser = {
  account: string
  icon: string
  userId: string
  enterId: string
}

export type Room = {
  id: string
  name: string
  iconUrl: string
  description: string
  unread: number
  replied: number
  messages: string[]
  loading: boolean
  receivedMessages: boolean
  existHistory: boolean
  status: 'open' | 'close'
}

type RoomsState = {
  roomsById: { [key: string]: Room }
  roomsAllIds: string[]
  roomsOrder: string[]
  usersById: {
    [key: string]: { count: number; users: RoomUser[] | readonly [] }
  }
  usersAllIds: string[]
  usersLoading: boolean
  currentRoomId: string
  currentRoomName: string
  currentRoomIcon: string
  currentRoomDescription: string
  scrollTargetIndex: number | 'bottom'
  openRoomSetting: boolean
}

const splited = window.location.pathname.split('/')
const initCurrentRoomName = splited[1] === 'rooms' ? splited[2] : ''

const roomsState = atom<RoomsState>({
  key: 'state:rooms',
  default: {
    roomsById: {},
    roomsAllIds: [],
    roomsOrder: [],
    usersById: {},
    usersAllIds: [],
    usersLoading: false,
    currentRoomId: '',
    currentRoomName: initCurrentRoomName,
    currentRoomIcon: null,
    currentRoomDescription: null,
    scrollTargetIndex: 'bottom',
    openRoomSetting: false
  }
})

export const useRooms = () => {
  const [rooms] = useRecoilState(roomsState)
  return rooms
}

export const useRoomActions = () => {
  const { getAccessToken } = useAuth()
  const [rooms, setRooms] = useRecoilState(roomsState)

  const getRoomMessages = useCallback(
    (
      roomId: string,
      getMessages: ReturnType<typeof useSocket>['getMessages']
    ) => {
      getMessages(roomId)

      const room = rooms.roomsById[roomId]
      if (room) {
        setRooms((current) => {
          const roomsById = {
            ...current.roomsById,
            [roomId]: { ...room, loading: true }
          }

          return { ...current, roomsById }
        })
      }
    },
    [rooms.roomsById, setRooms]
  )

  const createRoom = useCallback(
    async (
      name: string,
      getRooms: ReturnType<typeof useSocket>['getRooms']
    ) => {
      const body: REQUEST['/api/rooms']['POST']['body'] = {
        name
      }

      const { accessToken } = await getAccessToken()

      return await createApiClient(
        '/api/rooms',
        {
          method: 'POST',
          accessToken,
          body: JSON.stringify(body)
        },
        async (res) => {
          if (res.status !== 200) {
            return res
          }

          const room = (await res.json()) as RESPONSE['/api/rooms']['POST']
          getRooms()

          setRooms((current) => ({
            ...current,
            currentRoomId: room.id,
            currentRoomName: room.name,
            currentRoomIcon: '',
            currentRoomDescription: ''
          }))

          return res
        }
      )
    },
    [getAccessToken, setRooms]
  )

  const changeRoom = useCallback(
    (
      roomId: string,
      getMessages: ReturnType<typeof useSocket>['getMessages'],
      closeMenu: ReturnType<typeof useUi>['closeMenu']
    ) => {
      const room = rooms.roomsById[roomId]
      if (room) {
        if (!room.receivedMessages && !room.loading) {
          getMessages(roomId)
        }

        setRooms((current) => ({
          ...current,
          currentRoomId: room.id,
          currentRoomName: current.roomsById[room.id].name,
          currentRoomIcon: current.roomsById[room.id].iconUrl,
          currentRoomDescription: current.roomsById[room.id].description,
          scrollTargetIndex: 'bottom',
          openRoomSetting: false
        }))

        closeMenu()
        return
      }
    },
    [rooms.roomsById, setRooms]
  )

  const enterRoom = useCallback(
    async (
      roomName: string,
      getMessages: ReturnType<typeof useSocket>['getMessages'],
      enterRoomMessage: ReturnType<typeof useSocket>['enterRoom'],
      closeMenu: ReturnType<typeof useUi>['closeMenu']
    ) => {
      const room = Object.values(rooms.roomsById).find(
        (r) => r.name === roomName
      )
      if (room) {
        changeRoom(room.id, getMessages, closeMenu)
        return
      }
      enterRoomMessage(roomName)
      closeMenu()
    },
    [changeRoom, rooms.roomsById]
  )

  const exitRoom = useCallback(
    async (
      roomId: string,
      getRooms: ReturnType<typeof useSocket>['getRooms']
    ) => {
      const body: REQUEST['/api/rooms/enter']['DELETE']['body'] = {
        room: roomId
      }

      const { accessToken } = await getAccessToken()

      return await createApiClient(
        '/api/rooms/enter',
        {
          method: 'DELETE',
          accessToken,
          body: JSON.stringify(body)
        },
        async (res) => {
          if (res.status === 200) {
            getRooms()

            setRooms((current) => ({
              ...current,
              currentRoomId: '',
              currentRoomName: '',
              currentRoomIcon: '',
              currentRoomDescription: ''
            }))
          }
          return res
        }
      )
    },
    [getAccessToken, setRooms]
  )

  const receiveRooms = useCallback(
    (
      rooms: FilterToClientType<typeof TO_CLIENT_CMD.ROOMS_GET>['rooms'],
      roomOrder: string[],
      currentRoomId: string,
      getMessages: ReturnType<typeof useSocket>['getMessages']
    ) => {
      if (currentRoomId) {
        getMessages(currentRoomId)
      }

      setRooms((current) => {
        const allIds = []
        const roomsById = { ...current.roomsById }
        for (const r of rooms) {
          if (!allIds.includes(r.id)) {
            allIds.push(r.id)

            const room: Room = {
              id: r.id,
              name: r.name,
              description: r.description,
              iconUrl: r.iconUrl,
              unread: r.unread,
              replied: r.replied,
              messages: [],
              loading: false,
              receivedMessages: false,
              existHistory: false,
              status: r.status
            }
            roomsById[r.id] = room
          }
        }
        allIds.sort((a, b) => roomOrder.indexOf(a) - roomOrder.indexOf(b))
        return {
          ...current,
          roomsById,
          roomsAllIds: allIds,
          roomsOrder: roomOrder
        }
      })
    },
    [setRooms]
  )

  const sortRoomIds = (roomIds: string[], roomOrder: string[]) => {
    return [...roomIds].sort(
      (a, b) => roomOrder.indexOf(a) - roomOrder.indexOf(b)
    )
  }

  const setRoomOrder = useCallback(
    (roomsOrder: string[]) => {
      const roomsAllIds = sortRoomIds(rooms.roomsAllIds, roomsOrder)

      setRooms((current) => ({
        ...current,
        roomsOrder,
        roomsAllIds
      }))
    },
    [rooms.roomsAllIds, setRooms]
  )

  const changeRoomOrder = useCallback(
    (
      roomsOrder: string[],
      sortRoom: ReturnType<typeof useSocket>['sortRoom']
    ) => {
      const roomsAllIds = sortRoomIds(rooms.roomsAllIds, roomsOrder)

      setRooms((current) => ({ ...current, roomsOrder, roomsAllIds }))

      sortRoom(roomsAllIds)
    },
    [rooms.roomsAllIds, setRooms]
  )

  const receiveMessage = useCallback(
    (
      messageId: string,
      message: string,
      roomId: string,
      account: string,
      readMessages: ReturnType<typeof useSocket>['readMessages']
    ) => {
      // 現在みている部屋だったら既読フラグを返す
      if (roomId === rooms.currentRoomId) {
        readMessages(roomId)
      }

      setRooms((current) => {
        const isCurrent = roomId === current.currentRoomId
        const room = current.roomsById[roomId]
        const replied = isReplied(account, message)

        if (room.messages.includes(messageId)) {
          return current
        }

        const roomsById = {
          ...current.roomsById,
          [roomId]: {
            ...room,
            messages: [...room.messages, messageId],
            loading: false,
            unread: isCurrent ? room.unread : room.unread + 1,
            replied: replied ? room.replied + 1 : room.replied
          }
        }

        return {
          ...current,
          roomsById,
          roomsAllIds: [...current.roomsAllIds],
          scrollTargetIndex:
            roomId === current.currentRoomId
              ? 'bottom'
              : current.scrollTargetIndex
        }
      })
    },
    [rooms.currentRoomId, setRooms]
  )

  const receiveMessages = useCallback(
    ({
      messageIds,
      roomId,
      existHistory
    }: {
      messageIds: string[]
      roomId: string
      existHistory: boolean
    }) => {
      setRooms((current) => {
        // uniq
        const arr = [...messageIds, ...current.roomsById[roomId].messages]
        const messages = [...new Set(arr)]

        const scrollTargetIndex =
          roomId === current.currentRoomId &&
          !current.roomsById[roomId].receivedMessages
            ? messageIds.length
            : current.scrollTargetIndex

        const roomsById = {
          ...current.roomsById,
          [roomId]: {
            ...current.roomsById[roomId],
            messages,
            loading: false,
            receivedMessages: true,
            existHistory: existHistory
          }
        }

        return {
          ...current,
          roomsById,
          scrollTargetIndex
        }
      })
    },
    [setRooms]
  )

  const enterSuccess = useCallback(
    (
      roomId: string,
      name: string,
      description: string,
      iconUrl: string,
      getRooms: ReturnType<typeof useSocket>['getRooms'],
      getMessages: ReturnType<typeof useSocket>['getMessages']
    ) => {
      const room = rooms.roomsById[roomId]
      // すでに入っている部屋だったら部屋の再取得をしない
      if (!room) {
        getRooms()
      }
      let loading = false
      if (!room || (!room.receivedMessages && !room.loading)) {
        getMessages(roomId)
        loading = true
      }

      setRooms((current) => {
        const room = current.roomsById[roomId]
        const roomsById = room
          ? {
              ...current.roomsById,
              [roomId]: {
                ...current.roomsById[roomId],
                loading
              }
            }
          : current.roomsById

        return {
          ...current,
          roomsById,
          currentRoomId: roomId,
          currentRoomName: name,
          currentRoomIcon: iconUrl,
          currentRoomDescription: description
        }
      })
    },
    [rooms.roomsById, setRooms]
  )

  const fetchStartRoomUsers = useCallback(() => {
    setRooms((current) => ({ ...current, usersLoading: true }))
  }, [setRooms])

  const getUsers = useCallback(
    async (roomId: string) => {
      if (!roomId) {
        return
      }
      if (rooms.usersLoading) {
        return
      }

      fetchStartRoomUsers()

      const { accessToken } = await getAccessToken()

      return await createApiClient(
        `/api/rooms/${roomId}/users`,
        {
          method: 'GET',
          accessToken
        },
        async (res) => {
          if (res.status !== 200) {
            return res
          }

          res
            .json()
            .then((body: RESPONSE['/api/rooms/:roomid/users']['GET']) => {
              setRooms((current) => {
                const usersById = {
                  ...current.usersById,
                  [roomId]: {
                    users: body.users,
                    count: body.count
                  }
                }
                const usersAllIds = current.usersAllIds.includes(roomId)
                  ? current.usersAllIds
                  : [...current.usersAllIds, roomId]
                return {
                  ...current,
                  usersById,
                  usersAllIds,
                  usersLoading: false
                }
              })
            })

          return res
        }
      )
    },
    [fetchStartRoomUsers, getAccessToken, rooms.usersLoading, setRooms]
  )

  const getNextUsers = useCallback(
    async (roomId: string) => {
      if (!roomId) {
        return
      }

      if (rooms.usersLoading) {
        return
      }

      const { users, count } = rooms.usersById[roomId]
      if (users.length >= count) {
        return
      }

      fetchStartRoomUsers()

      const lastId = users[users.length - 1].enterId

      const init: [
        keyof REQUEST['/api/rooms/:roomid/users']['GET']['query'],
        string
      ][] = [['threshold', lastId]]

      const query = new URLSearchParams(init)

      const { accessToken } = await getAccessToken()

      return await createApiClient(
        `/api/rooms/${roomId}/users?${query.toString()}`,
        {
          method: 'GET',
          accessToken
        },
        async (res) => {
          if (res.status !== 200) {
            return res
          }

          res
            .json()
            .then((body: RESPONSE['/api/rooms/:roomid/users']['GET']) => {
              setRooms((current) => {
                const users = current.usersById[roomId]
                const usersById = {
                  ...current.usersById,
                  [roomId]: {
                    ...users,
                    users: [...users.users, ...body.users]
                  }
                }
                return {
                  ...current,
                  usersById,
                  usersLoading: false
                }
              })
            })

          return res
        }
      )
    },
    [
      fetchStartRoomUsers,
      getAccessToken,
      rooms.usersById,
      rooms.usersLoading,
      setRooms
    ]
  )

  const alreadyRead = useCallback(
    (roomId: string) => {
      setRooms((current) => {
        const roomsById = {
          ...current.roomsById,
          [roomId]: {
            ...current.roomsById[roomId],
            unread: 0,
            replied: 0
          }
        }
        return { ...current, roomsById, roomsAllIds: [...current.roomsAllIds] }
      })
    },
    [setRooms]
  )

  const reloadMessage = useCallback(
    (roomId: string) => {
      setRooms((current) => {
        const roomsById = {
          ...current.roomsById,
          [roomId]: {
            ...current.roomsById[roomId],
            messages: [...current.roomsById[roomId].messages]
          }
        }
        return { ...current, roomsById }
      })
    },
    [setRooms]
  )

  const toggleRoomSetting = useCallback(() => {
    setRooms((current) => ({
      ...current,
      openRoomSetting: !current.openRoomSetting
    }))
  }, [setRooms])

  const uploadIcon = useCallback(
    async (name: string, blob: Blob) => {
      const formData = new FormData()
      formData.append('icon', blob)
      const { accessToken } = await getAccessToken()
      const res = await fetch(`/api/icon/rooms/${name}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      if (res.ok) {
        const { id, version } =
          (await res.json()) as RESPONSE['/api/icon/rooms/:roomname']['POST']

        setRooms((current) => {
          const room = current.roomsById[id]
          const url = new URL(room.iconUrl, 'https://mzm.dev')
          url.searchParams.set('version', version)
          const roomsById = {
            ...current.roomsById,
            [id]: {
              ...room,
              // @todo check
              iconUrl: url.toString()
            }
          }
          return { ...current, roomsById }
        })
      }

      return res
    },
    [getAccessToken, setRooms]
  )

  const setRoomStatus = useCallback(
    (roomId: string, status: 'open' | 'close') => {
      setRooms((current) => {
        const room = current.roomsById[roomId]
        const roomsById = {
          ...current.roomsById,
          [roomId]: {
            ...room,
            status
          }
        }
        return { ...current, roomsById }
      })
    },
    [setRooms]
  )

  const setRoomDescription = useCallback(
    (roomId: string, description: string) => {
      setRooms((current) => {
        const room = current.roomsById[roomId]
        const roomsById = room
          ? {
              ...current.roomsById,
              [roomId]: {
                ...room,
                description
              }
            }
          : current.roomsById
        return { ...current, roomsById }
      })
    },
    [setRooms]
  )

  return {
    getRoomMessages,
    createRoom,
    changeRoom,
    enterRoom,
    exitRoom,
    receiveRooms,
    setRoomOrder,
    changeRoomOrder,
    receiveMessage,
    receiveMessages,
    enterSuccess,
    getUsers,
    getNextUsers,
    alreadyRead,
    reloadMessage,
    toggleRoomSetting,
    uploadIcon,
    setRoomStatus,
    setRoomDescription
  } as const
}
