import { useContext, useReducer, useCallback } from 'react'
import { ReceiveRoom } from '../../type'
import type { useDispatchSocket } from '../socket/hooks'
import type { useDispatchUi } from '../ui/hooks'
import type { useUser } from '../user/hooks'
import { RoomsContext, RoomsDispatchContext } from './index'
import { INITIAL_STATE, Actions } from './constants'
import { reducer } from './reducer'

export const useRooms = () => {
  return useContext(RoomsContext)
}

export const useDispatchRooms = () => {
  return useContext(RoomsDispatchContext)
}

export const useRoomsForContext = () => {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const getRoomMessages = (
    roomId: string,
    getMessages: ReturnType<typeof useDispatchSocket>['getMessages']
  ) => {
    getMessages(roomId)
    dispatch({ type: Actions.GetMessages, payload: { id: roomId } })
  }

  const createRoom = async (
    name: string,
    getRooms: ReturnType<typeof useDispatchSocket>['getRooms']
  ) => {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({ name })
    })
    if (res.status === 200) {
      const room: { id: string; name: string } = await res.json()
      getRooms()
      dispatch({
        type: Actions.CreateRoom,
        payload: { id: room.id, name: room.name }
      })
    }
    return res
  }

  const changeRoom = useCallback(
    (
      roomId: string,
      getMessages: ReturnType<typeof useDispatchSocket>['getMessages'],
      closeMenu: ReturnType<typeof useDispatchUi>['closeMenu']
    ) => {
      const room = state.rooms.byId[roomId]
      if (room) {
        if (!room.receivedMessages && !room.loading) {
          getMessages(roomId)
        }
        dispatch({
          type: Actions.ChangeRoom,
          payload: {
            id: room.id
          }
        })
        closeMenu()
        return
      }
    },
    [state.rooms.byId]
  )

  const enterRoom = async (
    roomName: string,
    getMessages: ReturnType<typeof useDispatchSocket>['getMessages'],
    enterRoom: ReturnType<typeof useDispatchSocket>['enterRoom'],
    closeMenu: ReturnType<typeof useDispatchUi>['closeMenu']
  ) => {
    const room = Object.values(state.rooms.byId).find(
      (r) => r.name === roomName
    )
    if (room) {
      changeRoom(room.id, getMessages, closeMenu)
      return
    }
    enterRoom(roomName)
    closeMenu()
  }

  const exitRoom = async (
    roomId: string,
    getRooms: ReturnType<typeof useDispatchSocket>['getRooms']
  ) => {
    const res = await fetch('/api/rooms/enter', {
      method: 'DELETE',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({ room: roomId })
    })
    if (res.status === 200) {
      getRooms()
      dispatch({ type: Actions.ExitRoom })
    }
    return res
  }

  const receiveRooms = (
    rooms: ReceiveRoom[],
    roomOrder: string[],
    currentRoomId: string,
    getMessages: ReturnType<typeof useDispatchSocket>['getMessages']
  ) => {
    if (currentRoomId) {
      getMessages(currentRoomId)
    }

    dispatch({
      type: Actions.SetRooms,
      payload: {
        rooms: rooms,
        roomOrder: roomOrder
      }
    })
  }

  const sortRoomIds = (roomIds: string[], roomOrder: string[]) => {
    return [...roomIds].sort(
      (a, b) => roomOrder.indexOf(a) - roomOrder.indexOf(b)
    )
  }

  const setRoomOrder = (roomOrder: string[]) => {
    const newOrder = sortRoomIds(state.rooms.allIds, roomOrder)
    dispatch({
      type: Actions.SetRoomOrder,
      payload: { roomOrder, allIds: newOrder }
    })
  }

  const changeRoomOrder = (
    roomOrder: string[],
    sortRoom: ReturnType<typeof useDispatchSocket>['sortRoom']
  ) => {
    const newOrder = sortRoomIds(state.rooms.allIds, roomOrder)
    dispatch({
      type: Actions.SetRoomOrder,
      payload: { roomOrder, allIds: newOrder }
    })
    sortRoom(newOrder)
  }

  const receiveMessage = (
    messageId: string,
    message: string,
    room: string,
    me: ReturnType<typeof useUser>['me'],
    readMessages: ReturnType<typeof useDispatchSocket>['readMessages']
  ) => {
    // 現在みている部屋だったら既読フラグを返す
    if (room === state.currentRoomId) {
      readMessages(room)
    }
    return dispatch({
      type: Actions.ReceiveMessage,
      payload: {
        messageId: messageId,
        message: message,
        room: room,
        account: me.account
      }
    })
  }

  const receiveMessages = ({
    messageIds,
    room,
    existHistory
  }: {
    messageIds: string[]
    room: string
    existHistory: boolean
  }) => {
    return dispatch({
      type: Actions.ReceiveMessages,
      payload: {
        room: room,
        existHistory: existHistory,
        messages: messageIds
      }
    })
  }

  const enterSuccess = (
    id: string,
    name: string,
    iconUrl: string,
    getRooms: ReturnType<typeof useDispatchSocket>['getRooms'],
    getMessages: ReturnType<typeof useDispatchSocket>['getMessages']
  ) => {
    const room = state.rooms.byId[id]
    // すでに入っている部屋だったら部屋の再取得をしない
    if (!room) {
      getRooms()
    }
    let loading = false
    if (room && !room.receivedMessages && !loading) {
      getMessages(id)
      loading = true
    }
    dispatch({
      type: Actions.EnterRoomSuccess,
      payload: { id: id, name: name, iconUrl, loading }
    })
  }

  const getUsers = async (roomId: string) => {
    if (!roomId) {
      return
    }
    const res = await fetch(`/api/rooms/${roomId}/users`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })

    if (res.status === 200) {
      res.json().then((body) => {
        dispatch({
          type: Actions.SetRoomUsers,
          payload: { room: roomId, users: body.users, count: body.count }
        })
      })
    }

    return res
  }

  const getNextUsers = async (roomId: string) => {
    if (!roomId) {
      return
    }
    const { users, count } = state.users.byId[roomId]
    if (users.length >= count) {
      return
    }
    const lastId = users[users.length - 1].enterId
    const query = new URLSearchParams([['threshold', lastId]])
    const res = await fetch(`/api/rooms/${roomId}/users?${query.toString()}`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })

    if (res.status !== 200) {
      return res
    }

    res.json().then((body) => {
      dispatch({
        type: Actions.SetNextRoomUsers,
        payload: { room: roomId, users: body.users }
      })
    })

    return res
  }

  const alreadyRead = (roomId: string) => {
    dispatch({ type: Actions.AlreadyRead, payload: { room: roomId } })
  }

  const reloadMessage = (roomId: string) => {
    dispatch({
      type: Actions.ReloadMessages,
      payload: { room: roomId }
    })
  }

  const toggleRoomSetting = () => {
    dispatch({ type: Actions.ToggleSetting })
  }

  const closeRoomSetting = () => {
    dispatch({ type: Actions.CloseSetting })
  }

  const uploadIcon = async (name: string, blob: Blob) => {
    const formData = new FormData()
    formData.append('icon', blob)
    const res = await fetch(`/api/icon/rooms/${name}`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    })

    if (res.ok) {
      const { id, version } = await res.json()
      dispatch({ type: Actions.SetIcon, payload: { id, version } })
    }

    return res
  }

  const setRoomStatus = (id: string, status: 'open' | 'close') => {
    dispatch({ type: Actions.SetRoomStatus, payload: { id, status } })
  }

  return {
    state,
    getRoomMessages: useCallback(getRoomMessages, []),
    createRoom: useCallback(createRoom, []),
    changeRoom,
    enterRoom: useCallback(enterRoom, [changeRoom, state.rooms.byId]),
    exitRoom: useCallback(exitRoom, []),
    receiveRooms: useCallback(receiveRooms, []),
    setRoomOrder: useCallback(setRoomOrder, [state.rooms.allIds]),
    changeRoomOrder: useCallback(changeRoomOrder, [state.rooms.allIds]),
    receiveMessage: useCallback(receiveMessage, [state.currentRoomId]),
    receiveMessages: useCallback(receiveMessages, []),
    enterSuccess: useCallback(enterSuccess, [state.rooms.byId]),
    getUsers: useCallback(getUsers, []),
    getNextUsers: useCallback(getNextUsers, [state.users.byId]),
    alreadyRead: useCallback(alreadyRead, []),
    reloadMessage: useCallback(reloadMessage, []),
    toggleRoomSetting: useCallback(toggleRoomSetting, []),
    closeRoomSetting: useCallback(closeRoomSetting, []),
    uploadIcon: useCallback(uploadIcon, []),
    setRoomStatus: useCallback(setRoomStatus, [])
  } as const
}
