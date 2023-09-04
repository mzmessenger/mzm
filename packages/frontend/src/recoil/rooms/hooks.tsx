import { type API } from 'mzm-shared/src/type/api'
import type { useSocketActions } from '../../recoil/socket/hooks'
import type { useUiActions } from '../../recoil/ui/hooks'
import type { Room } from './types'
import { useCallback } from 'react'
import {
  atom,
  useRecoilState,
  useSetRecoilState,
  useRecoilValue,
  selectorFamily,
  type SetterOrUpdater
} from 'recoil'
import { FilterToClientType, TO_CLIENT_CMD } from 'mzm-shared/src/type/socket'
import { clients, uploadRoomIcon } from '../../lib/client'
import { isReplied } from '../../lib/util'

type RoomUser = {
  account: string
  icon: string
  userId: string
  enterId: string
}

const splited = window.location.pathname.split('/')
const initCurrentRoomName = splited[1] === 'rooms' ? splited[2] : ''

type OpenRoomSettingState = {
  openRoomSetting: boolean
}

const openRoomSettingState = atom<OpenRoomSettingState>({
  key: 'state:rooms:openRoomSettingState',
  default: {
    openRoomSetting: false
  }
})
export const useOpenRoomSettingFlag = () => {
  const { openRoomSetting } = useRecoilValue(openRoomSettingState)
  return openRoomSetting
}

export const useRoomSettingActions = () => {
  const setOpenRoomSetting = useSetRecoilState(openRoomSettingState)

  const toggleRoomSetting = useCallback(() => {
    setOpenRoomSetting((current) => ({
      openRoomSetting: !current.openRoomSetting
    }))
  }, [setOpenRoomSetting])

  return {
    toggleRoomSetting
  }
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

const getRoomById = selectorFamily({
  key: 'state:rooms:roomsById:id',
  get:
    (roomId: string) =>
    ({ get }) => {
      const byId = get(roomsByIdState)
      return byId[roomId]
    }
})
export const useRoomById = (roomId: string) =>
  useRecoilValue(getRoomById(roomId))

const roomsAllIdsState = atom<string[]>({
  key: 'state:rooms:roomsAllIds',
  default: []
})

export const useRoomsAllIds = () => useRecoilValue(roomsAllIdsState)

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

const getUsersById = selectorFamily({
  key: 'state:rooms:usersById:id',
  get:
    (roomId: string) =>
    ({ get }) => {
      const { usersById } = get(roomsState)
      return usersById[roomId]
    }
})

export const useGetUsersById = (roomId: string) =>
  useRecoilValue(getUsersById(roomId))

export const useRooms = () => {
  const { scrollTargetIndex } = useRecoilValue(roomsState)

  return {
    scrollTargetIndex
  }
}

const sortRoomIds = (roomIds: string[], roomOrder: string[]) => {
  return [...roomIds].sort(
    (a, b) => roomOrder.indexOf(a) - roomOrder.indexOf(b)
  )
}

const sharedActions = {
  changeRoom: (args: {
    roomId: string
    currentRoomId: string
    roomsById: RoomsById
    setRooms: SetterOrUpdater<RoomsState>
    setCurrentRoom: SetterOrUpdater<CurrentRoomState>
    setOpenRoomSetting: SetterOrUpdater<OpenRoomSettingState>
    handlers: {
      getMessages: (roomId: string) => void
      closeMenu: ReturnType<typeof useUiActions>['closeMenu']
    }
  }) => {
    if (args.currentRoomId === args.roomId) {
      return
    }
    const room = args.roomsById[args.roomId]
    if (room) {
      if (!room.receivedMessages && !room.loading) {
        args.handlers.getMessages(args.roomId)
      }

      args.setRooms((current) => ({
        ...current,
        scrollTargetIndex: 'bottom'
      }))

      args.setCurrentRoom({
        currentRoomId: room.id,
        currentRoomName: room.name,
        currentRoomIcon: room.iconUrl,
        currentRoomDescription: room.description
      })

      if (openRoomSettingState) {
        args.setOpenRoomSetting({ openRoomSetting: false })
      }

      args.handlers.closeMenu()
      return
    }
  }
} as const

export const useChangeRoomActions = ({
  getMessages,
  closeMenu
}: {
  getMessages: ReturnType<typeof useSocketActions>['getMessages']
  closeMenu: ReturnType<typeof useUiActions>['closeMenu']
}) => {
  const setOpenRoomSetting = useSetRecoilState(openRoomSettingState)
  const [{ currentRoomId }, setCurrentRoom] = useRecoilState(currentRoomState)
  const roomsById = useRecoilValue(roomsByIdState)
  const setRooms = useSetRecoilState(roomsState)

  const changeRoom = useCallback(
    (roomId: string) => {
      sharedActions.changeRoom({
        roomId,
        currentRoomId,
        roomsById,
        setRooms,
        setCurrentRoom,
        setOpenRoomSetting,
        handlers: {
          getMessages,
          closeMenu
        }
      })
    },
    [
      currentRoomId,
      roomsById,
      setRooms,
      setCurrentRoom,
      closeMenu,
      getMessages,
      setOpenRoomSetting
    ]
  )

  return {
    changeRoom
  } as const
}

export const useChangeRoomOrderActions = ({
  sortRoom
}: {
  sortRoom: ReturnType<typeof useSocketActions>['sortRoom']
}) => {
  const setRoomsOrder = useSetRecoilState(roomsOrderState)
  const [roomsAllIds, setRoomsAllIds] = useRecoilState(roomsAllIdsState)

  const changeRoomOrder = useCallback(
    (roomsOrder: string[]) => {
      const newRoomsAllIds = sortRoomIds(roomsAllIds, roomsOrder)

      setRoomsOrder({ roomsOrder })

      setRoomsAllIds(newRoomsAllIds)

      sortRoom(newRoomsAllIds)
    },
    [roomsAllIds, setRoomsAllIds, setRoomsOrder, sortRoom]
  )

  return {
    changeRoomOrder
  } as const
}

export const useEnterRoomActions = ({
  getMessages,
  closeMenu,
  enterRoomSocket
}: {
  closeMenu: ReturnType<typeof useUiActions>['closeMenu']
  enterRoomSocket: ReturnType<typeof useSocketActions>['enterRoom']
} & Parameters<typeof useChangeRoomActions>[0]) => {
  const roomsById = useRecoilValue(roomsByIdState)
  const { changeRoom } = useChangeRoomActions({
    getMessages,
    closeMenu
  })

  const enterRoom = useCallback(
    async (roomName: string) => {
      const room = Object.values(roomsById).find((r) => r.name === roomName)
      if (room) {
        changeRoom(room.id)
        return
      }
      enterRoomSocket(roomName)
      closeMenu()
    },
    [roomsById, enterRoomSocket, closeMenu, changeRoom]
  )

  return {
    enterRoom
  }
}

export const useRoomStatusActions = () => {
  const setRoomsById = useSetRecoilState(roomsByIdState)

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

  return {
    setRoomStatus
  } as const
}

export const useRoomMessageActions = ({
  getMessages
}: {
  getMessages: ReturnType<typeof useSocketActions>['getMessages']
}) => {
  const [roomsById, setRoomsById] = useRecoilState(roomsByIdState)

  const getRoomMessages = useCallback(
    (roomId: string) => {
      getMessages(roomId)

      const room = roomsById[roomId]
      if (room) {
        setRoomsById((current) => ({
          ...current,
          [roomId]: { ...room, loading: true }
        }))
      }
    },
    [getMessages, roomsById, setRoomsById]
  )

  return {
    getRoomMessages
  }
}

export const useRoomUserActions = () => {
  const [rooms, setRooms] = useRecoilState(roomsState)

  const fetchStartRoomUsers = useCallback(() => {
    setRooms((current) => ({ ...current, usersLoading: true }))
  }, [setRooms])

  type GetUsersType = API['/api/rooms/:roomId/users']
  const getUsers = useCallback(
    async (params: GetUsersType['params']) => {
      if (!params.roomId) {
        return
      }
      if (rooms.usersLoading) {
        return
      }

      fetchStartRoomUsers()

      const res = await clients['/api/rooms/:roomId/users']['GET'].client({
        params,
        query: {}
      })

      if (res.status !== 200) {
        return res
      }

      const body = res.body as GetUsersType['GET']['response'][200]['body']
      setRooms((current) => {
        const usersById = {
          ...current.usersById,
          [params.roomId]: {
            users: body.users,
            count: body.count
          }
        }
        const usersAllIds = current.usersAllIds.includes(params.roomId)
          ? current.usersAllIds
          : [...current.usersAllIds, params.roomId]
        return {
          ...current,
          usersById,
          usersAllIds,
          usersLoading: false
        }
      })

      return res
    },
    [fetchStartRoomUsers, rooms.usersLoading, setRooms]
  )

  type GetNextUsersType = API['/api/rooms/:roomId/users']
  const getNextUsers = useCallback(
    async (params: GetNextUsersType['params']) => {
      if (!params.roomId) {
        return
      }

      if (rooms.usersLoading) {
        return
      }

      const { users, count } = rooms.usersById[params.roomId]
      if (users.length >= count) {
        return
      }

      fetchStartRoomUsers()

      const lastId = users[users.length - 1].enterId

      const res = await clients['/api/rooms/:roomId/users']['GET'].client({
        params,
        query: { threshold: lastId }
      })

      if (res.status !== 200) {
        return res
      }

      const body = res.body as GetNextUsersType['GET']['response'][200]['body']

      setRooms((current) => {
        const users = current.usersById[params.roomId]
        const usersById = {
          ...current.usersById,
          [params.roomId]: {
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

      return res
    },
    [fetchStartRoomUsers, rooms.usersById, rooms.usersLoading, setRooms]
  )

  return {
    getUsers,
    getNextUsers
  }
}

export const useRoomActions = ({
  getRooms
}: {
  getRooms: ReturnType<typeof useSocketActions>['getRooms']
}) => {
  const setCurrentRoom = useSetRecoilState(currentRoomState)
  const setRoomsById = useSetRecoilState(roomsByIdState)
  const setOpenRoomSettingState = useSetRecoilState(openRoomSettingState)

  type CreateRoomType = API['/api/rooms']['POST']
  const createRoom = useCallback(
    async (body: CreateRoomType['request']['body']) => {
      const res = await clients['/api/rooms']['POST'].client({ body })
      if (res.status !== 200) {
        return res
      }

      const room = res.body as CreateRoomType['response'][200]['body']
      getRooms()

      setCurrentRoom({
        currentRoomId: room.id,
        currentRoomName: room.name,
        currentRoomIcon: '',
        currentRoomDescription: ''
      })

      return res
    },
    [getRooms, setCurrentRoom]
  )

  type ExitRoomType = API['/api/rooms/enter']['DELETE']
  const exitRoom = useCallback(
    async (body: ExitRoomType['request']['body']) => {
      const res = await clients['/api/rooms/enter']['DELETE'].client({ body })
      if (res.status === 200) {
        setOpenRoomSettingState({ openRoomSetting: false })

        getRooms()

        setCurrentRoom({
          currentRoomId: '',
          currentRoomName: '',
          currentRoomIcon: '',
          currentRoomDescription: ''
        })
      }
      return res
    },
    [getRooms, setCurrentRoom, setOpenRoomSettingState]
  )

  const uploadIcon = useCallback(
    async (params: Parameters<typeof uploadRoomIcon>[0], blob: Blob) => {
      const res = await uploadRoomIcon(params, blob)
      if (res.ok) {
        const { id, version } = res.body

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
    [setRoomsById]
  )

  return {
    createRoom,
    exitRoom,
    uploadIcon
  } as const
}

export const useRoomActionsForSocket = () => {
  const [{ currentRoomId, currentRoomName }, setCurrentRoom] =
    useRecoilState(currentRoomState)
  const setRoomsOrder = useSetRecoilState(roomsOrderState)
  const [roomsById, setRoomsById] = useRecoilState(roomsByIdState)
  const setRoomsAllIds = useSetRecoilState(roomsAllIdsState)
  const setRooms = useSetRecoilState(roomsState)
  const setOpenRoomSetting = useSetRecoilState(openRoomSettingState)

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
          roomId === currentRoomId && !roomsById[roomId].receivedMessages
            ? messageIds.length
            : current.scrollTargetIndex

        return {
          ...current,
          scrollTargetIndex
        }
      })
    },
    [setRoomsById, setRooms, currentRoomId, roomsById]
  )

  const receiveMessage = useCallback(
    (
      messageId: string,
      message: string,
      roomId: string,
      account: string,
      handlers: {
        readMessages: (roomId: string) => void
      }
    ) => {
      // 現在みている部屋だったら既読フラグを返す
      if (roomId === currentRoomId) {
        handlers.readMessages(roomId)
      }

      setRoomsById((current) => {
        const isCurrent = roomId === currentRoomId
        const room = current[roomId]
        const replied = isReplied(account, message)

        if (room.messages.includes(messageId)) {
          return current
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

      setRooms((current) => {
        return {
          ...current,
          scrollTargetIndex:
            roomId === currentRoomId ? 'bottom' : current.scrollTargetIndex
        }
      })
    },
    [currentRoomId, setRooms, setRoomsById]
  )

  const receiveRooms = useCallback(
    (
      rooms: FilterToClientType<typeof TO_CLIENT_CMD.ROOMS_GET>['rooms'],
      roomsOrder: string[],
      currentRoomId: string,
      handlers: {
        getMessages: (currentRoomId: string) => void
      }
    ) => {
      if (currentRoomId) {
        handlers.getMessages(currentRoomId)
      }

      const allIds: string[] = []
      const updateRoomsById: RoomsById = {}
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
          updateRoomsById[r.id] = room
        }
      }

      allIds.sort((a, b) => roomsOrder.indexOf(a) - roomsOrder.indexOf(b))

      setRoomsById(updateRoomsById)
      setRoomsAllIds(allIds)
      setRoomsOrder({ roomsOrder })
    },
    [setRoomsById, setRoomsAllIds, setRoomsOrder]
  )

  const enterSuccess = useCallback(
    (
      roomId: string,
      name: string,
      description: string,
      iconUrl: string,
      handlers: {
        getRooms: () => void
        getMessages: (roomId: string) => void
      }
    ) => {
      const room = roomsById[roomId]
      // すでに入っている部屋だったら部屋の再取得をしない
      if (!room) {
        handlers.getRooms()
      }
      let loading = false
      if (!room || (!room.receivedMessages && !room.loading)) {
        handlers.getMessages(roomId)
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

  const setRoomOrder = useCallback(
    (roomsOrder: string[]) => {
      setRoomsOrder({ roomsOrder })

      setRoomsAllIds((current) => sortRoomIds(current, roomsOrder))
    },
    [setRoomsAllIds, setRoomsOrder]
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

  const changeRoom = useCallback(
    (
      roomId: string,
      handlers: {
        getMessages: (roomId: string) => void
        closeMenu: ReturnType<typeof useUiActions>['closeMenu']
      }
    ) => {
      sharedActions.changeRoom({
        roomId,
        currentRoomId,
        roomsById,
        setRooms,
        setCurrentRoom,
        setOpenRoomSetting,
        handlers: {
          getMessages: handlers.getMessages,
          closeMenu: handlers.closeMenu
        }
      })
    },
    [currentRoomId, roomsById, setRooms, setCurrentRoom, setOpenRoomSetting]
  )

  return {
    currentRoomId,
    currentRoomName,
    receiveMessages,
    receiveMessage,
    receiveRooms,
    enterSuccess,
    reloadMessage,
    alreadyRead,
    setRoomOrder,
    setRoomDescription,
    changeRoom
  } as const
}
