import type { RESPONSE, REQUEST } from 'mzm-shared/type/api'
import type { useSocketActions } from '../../recoil/socket/hooks'
import type { useUi } from '../../recoil/ui/hooks'
import type { useAuth } from '../../recoil/auth/hooks'
import type { Room } from './types'
import { useCallback } from 'react'
import { atom, useRecoilState, useRecoilValue, selectorFamily } from 'recoil'
import { FilterToClientType, TO_CLIENT_CMD } from 'mzm-shared/type/socket'
import { createApiClient } from '../../lib/client'
import { isReplied } from '../../lib/util'

type RoomUser = {
  account: string
  icon: string
  userId: string
  enterId: string
}

const splited = window.location.pathname.split('/')
const initCurrentRoomName = splited[1] === 'rooms' ? splited[2] : ''

const openRoomSettingState = atom<{ openRoomSetting: boolean }>({
  key: 'state:rooms:openRoomSettingState',
  default: {
    openRoomSetting: false
  }
})
export const useOpenRoomSettingFlag = () => {
  const { openRoomSetting } = useRecoilValue(openRoomSettingState)
  return openRoomSetting
}

type CurrentRoomState = {
  currentRoomId: string
  currentRoomName: string
  currentRoomIcon: string
  currentRoomDescription: string
}

const currentRoomState = atom<CurrentRoomState>({
  key: 'state:rooms:currentRoomState',
  default: {
    currentRoomId: '',
    currentRoomName: initCurrentRoomName,
    currentRoomIcon: null,
    currentRoomDescription: null
  }
})
export const useCurrentRoom = () => {
  const {
    currentRoomId,
    currentRoomName,
    currentRoomIcon,
    currentRoomDescription
  } = useRecoilValue(currentRoomState)
  return {
    currentRoomId,
    currentRoomName,
    currentRoomIcon,
    currentRoomDescription
  }
}

type RoomsById = { [key: string]: Room }

const roomsByIdState = atom<RoomsById>({
  key: 'state:rooms:roomsById',
  default: {}
})

const getRoomFromRoomsById = selectorFamily({
  key: 'state:rooms:roomsById:id',
  get:
    (roomId: string) =>
    ({ get }) => {
      const byId = get(roomsByIdState)
      return byId[roomId]
    }
})
export const useRoomById = (roomId: string) =>
  useRecoilValue(getRoomFromRoomsById(roomId))

const roomsAllIdsState = atom<string[]>({
  key: 'state:rooms:roomsAllIds',
  default: []
})
export const useRoomsAllIdsState = () => useRecoilValue(roomsAllIdsState)

const roomsOrderState = atom<{ roomsOrder: string[] }>({
  key: 'state:rooms:roomsOrder',
  default: {
    roomsOrder: []
  }
})

type RoomsState = {
  usersById: {
    [key: string]: { count: number; users: RoomUser[] | readonly [] }
  }
  usersAllIds: string[]
  usersLoading: boolean
  scrollTargetIndex: number | 'bottom'
}

const roomsState = atom<RoomsState>({
  key: 'state:rooms',
  default: {
    usersById: {},
    usersAllIds: [],
    usersLoading: false,
    scrollTargetIndex: 'bottom'
  }
})

export const useRooms = () => {
  const [rooms] = useRecoilState(roomsState)
  return rooms
}

export const useChangeRoomActions = () => {
  const [, setOpenRoomSetting] = useRecoilState(openRoomSettingState)
  const [, setRoomsOrder] = useRecoilState(roomsOrderState)
  const [, setCurrentRoom] = useRecoilState(currentRoomState)
  const [roomsById] = useRecoilState(roomsByIdState)
  const [roomsAllIds, setRoomsAllIds] = useRecoilState(roomsAllIdsState)
  const [, setRooms] = useRecoilState(roomsState)

  const changeRoom = useCallback(
    (
      roomId: string,
      getMessages: ReturnType<typeof useSocketActions>['getMessages'],
      closeMenu: ReturnType<typeof useUi>['closeMenu']
    ) => {
      const room = roomsById[roomId]
      if (room) {
        if (!room.receivedMessages && !room.loading) {
          getMessages(roomId)
        }

        setRooms((current) => ({
          ...current,
          scrollTargetIndex: 'bottom'
        }))

        setCurrentRoom({
          currentRoomId: room.id,
          currentRoomName: room.name,
          currentRoomIcon: room.iconUrl,
          currentRoomDescription: room.description
        })

        if (openRoomSettingState) {
          setOpenRoomSetting({ openRoomSetting: false })
        }

        closeMenu()
        return
      }
    },
    [roomsById, setCurrentRoom, setOpenRoomSetting, setRooms]
  )

  const sortRoomIds = (roomIds: string[], roomOrder: string[]) => {
    return [...roomIds].sort(
      (a, b) => roomOrder.indexOf(a) - roomOrder.indexOf(b)
    )
  }

  const changeRoomOrder = useCallback(
    (
      roomsOrder: string[],
      sortRoom: ReturnType<typeof useSocketActions>['sortRoom']
    ) => {
      const newRoomsAllIds = sortRoomIds(roomsAllIds, roomsOrder)

      setRoomsOrder({ roomsOrder })

      setRoomsAllIds(newRoomsAllIds)

      sortRoom(newRoomsAllIds)
    },
    [roomsAllIds, setRoomsAllIds, setRoomsOrder]
  )

  const enterRoom = useCallback(
    async (
      roomName: string,
      getMessages: ReturnType<typeof useSocketActions>['getMessages'],
      enterRoomMessage: ReturnType<typeof useSocketActions>['enterRoom'],
      closeMenu: ReturnType<typeof useUi>['closeMenu']
    ) => {
      const room = Object.values(roomsById).find((r) => r.name === roomName)
      if (room) {
        changeRoom(room.id, getMessages, closeMenu)
        return
      }
      enterRoomMessage(roomName)
      closeMenu()
    },
    [changeRoom, roomsById]
  )

  return {
    changeRoom,
    changeRoomOrder,
    enterRoom
  } as const
}

export const useRoomActions = ({
  getAccessToken
}: {
  getAccessToken: ReturnType<typeof useAuth>['getAccessToken']
}) => {
  const [, setOpenRoomSetting] = useRecoilState(openRoomSettingState)
  const [, setRoomsOrder] = useRecoilState(roomsOrderState)
  const [currentRoom, setCurrentRoom] = useRecoilState(currentRoomState)
  const [roomsById, setRoomsById] = useRecoilState(roomsByIdState)
  const [, setRoomsAllIds] = useRecoilState(roomsAllIdsState)
  const [rooms, setRooms] = useRecoilState(roomsState)

  const getRoomMessages = useCallback(
    (
      roomId: string,
      getMessages: ReturnType<typeof useSocketActions>['getMessages']
    ) => {
      getMessages(roomId)

      const room = roomsById[roomId]
      if (room) {
        setRoomsById((current) => ({
          ...current,
          [roomId]: { ...room, loading: true }
        }))
      }
    },
    [roomsById, setRoomsById]
  )

  const createRoom = useCallback(
    async (
      name: string,
      getRooms: ReturnType<typeof useSocketActions>['getRooms']
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

          setCurrentRoom({
            currentRoomId: room.id,
            currentRoomName: room.name,
            currentRoomIcon: '',
            currentRoomDescription: ''
          })

          return res
        }
      )
    },
    [getAccessToken, setCurrentRoom]
  )

  const exitRoom = useCallback(
    async (
      roomId: string,
      getRooms: ReturnType<typeof useSocketActions>['getRooms']
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

            setCurrentRoom({
              currentRoomId: '',
              currentRoomName: '',
              currentRoomIcon: '',
              currentRoomDescription: ''
            })
          }
          return res
        }
      )
    },
    [getAccessToken, setCurrentRoom]
  )

  const receiveRooms = useCallback(
    (
      rooms: FilterToClientType<typeof TO_CLIENT_CMD.ROOMS_GET>['rooms'],
      roomsOrder: string[],
      currentRoomId: string,
      getMessages: ReturnType<typeof useSocketActions>['getMessages']
    ) => {
      if (currentRoomId) {
        getMessages(currentRoomId)
      }

      const allIds = []
      const newRoomsById = { ...roomsById }
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
          newRoomsById[r.id] = room
        }
      }

      allIds.sort((a, b) => roomsOrder.indexOf(a) - roomsOrder.indexOf(b))

      setRoomsById(newRoomsById)
      setRoomsAllIds(allIds)
      setRoomsOrder({ roomsOrder })
    },
    [roomsById, setRoomsById, setRoomsAllIds, setRoomsOrder]
  )

  const sortRoomIds = (roomIds: string[], roomOrder: string[]) => {
    return [...roomIds].sort(
      (a, b) => roomOrder.indexOf(a) - roomOrder.indexOf(b)
    )
  }

  const setRoomOrder = useCallback(
    (roomsOrder: string[]) => {
      setRoomsOrder({ roomsOrder })

      setRoomsAllIds((current) => sortRoomIds(current, roomsOrder))
    },
    [setRoomsAllIds, setRoomsOrder]
  )

  const receiveMessage = useCallback(
    (
      messageId: string,
      message: string,
      roomId: string,
      account: string,
      readMessages: ReturnType<typeof useSocketActions>['readMessages']
    ) => {
      // 現在みている部屋だったら既読フラグを返す
      if (roomId === currentRoom.currentRoomId) {
        readMessages(roomId)
      }

      setRoomsById((current) => {
        const isCurrent = roomId === currentRoom.currentRoomId
        const room = current[roomId]
        const replied = isReplied(account, message)

        if (room.messages.includes(messageId)) {
          return
        }

        return {
          ...current,
          [roomId]: {
            ...room,
            messages: [...room.messages, messageId],
            loading: false,
            unread: isCurrent ? room.unread : room.unread + 1,
            replied: replied ? room.replied + 1 : room.replied
          }
        }
      })
      setRoomsAllIds((current) => [...current])

      setRooms((current) => {
        return {
          ...current,
          scrollTargetIndex:
            roomId === currentRoom.currentRoomId
              ? 'bottom'
              : current.scrollTargetIndex
        }
      })
    },
    [currentRoom.currentRoomId, setRooms, setRoomsAllIds, setRoomsById]
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
      setRoomsById((current) => {
        // uniq
        const set = new Set([...messageIds, ...current[roomId].messages])
        const messages = [...set]

        return {
          ...current,
          [roomId]: {
            ...current[roomId],
            messages,
            loading: false,
            receivedMessages: true,
            existHistory: existHistory
          }
        }
      })

      setRooms((current) => {
        const scrollTargetIndex =
          roomId === currentRoom.currentRoomId &&
          !roomsById[roomId].receivedMessages
            ? messageIds.length
            : current.scrollTargetIndex

        return {
          ...current,
          scrollTargetIndex
        }
      })
    },
    [currentRoom.currentRoomId, roomsById, setRooms, setRoomsById]
  )

  const enterSuccess = useCallback(
    (
      roomId: string,
      name: string,
      description: string,
      iconUrl: string,
      getRooms: ReturnType<typeof useSocketActions>['getRooms'],
      getMessages: ReturnType<typeof useSocketActions>['getMessages']
    ) => {
      const room = roomsById[roomId]
      // すでに入っている部屋だったら部屋の再取得をしない
      if (!room) {
        getRooms()
      }
      let loading = false
      if (!room || (!room.receivedMessages && !room.loading)) {
        getMessages(roomId)
        loading = true
      }

      setRoomsById((current) => {
        const roomsById = room
          ? {
              ...current,
              [roomId]: {
                ...current[roomId],
                loading
              }
            }
          : current

        return roomsById
      })

      setCurrentRoom({
        currentRoomId: roomId,
        currentRoomName: name,
        currentRoomIcon: iconUrl,
        currentRoomDescription: description
      })
    },
    [roomsById, setCurrentRoom, setRoomsById]
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
      setRoomsById((current) => {
        return {
          ...current,
          [roomId]: {
            ...current[roomId],
            unread: 0,
            replied: 0
          }
        }
      })

      setRoomsAllIds((current) => [...current])
    },
    [setRoomsAllIds, setRoomsById]
  )

  const reloadMessage = useCallback(
    (roomId: string) => {
      setRoomsById((current) => {
        return {
          ...current,
          [roomId]: {
            ...current[roomId],
            messages: [...current[roomId].messages]
          }
        }
      })
    },
    [setRoomsById]
  )

  const toggleRoomSetting = useCallback(() => {
    setOpenRoomSetting((current) => ({
      openRoomSetting: !current.openRoomSetting
    }))
  }, [setOpenRoomSetting])

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

        setRoomsById((current) => {
          const room = current[id]
          const url = new URL(room.iconUrl, 'https://mzm.dev')
          url.searchParams.set('version', version)
          return {
            ...current,
            [id]: {
              ...room,
              // @todo check
              iconUrl: url.toString()
            }
          }
        })
      }

      return res
    },
    [getAccessToken, setRoomsById]
  )

  const setRoomStatus = useCallback(
    (roomId: string, status: 'open' | 'close') => {
      setRoomsById((current) => {
        const room = current[roomId]
        return {
          ...current,
          [roomId]: {
            ...room,
            status
          }
        }
      })
    },
    [setRoomsById]
  )

  const setRoomDescription = useCallback(
    (roomId: string, description: string) => {
      setRoomsById((current) => {
        const room = current[roomId]
        const roomsById = room
          ? {
              ...current,
              [roomId]: {
                ...room,
                description
              }
            }
          : current
        return roomsById
      })
    },
    [setRoomsById]
  )

  return {
    getRoomMessages,
    createRoom,
    exitRoom,
    receiveRooms,
    setRoomOrder,
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
