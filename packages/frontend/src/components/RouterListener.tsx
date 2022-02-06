import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { State, store } from '../modules/index'
import { getMyInfo } from '../modules/user'
import { enterRoom } from '../modules/rooms'

const RouterListener = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const currentRoomName = useSelector(
    (state: State) => state.rooms.currentRoomName
  )
  const login = useSelector((state: State) => state.user.login)
  const signup = useSelector((state: State) => state.user.signup)
  const dispatch = useDispatch()

  useEffect(() => {
    if (login && currentRoomName === '') {
      navigate('/')
    }
  }, [login, currentRoomName])

  useEffect(() => {
    const room = location.pathname.match(/\/rooms\/(.+)/) && RegExp.$1
    if (!login && (location.pathname === '/' || room)) {
      getMyInfo()(dispatch)
    }

    if (login && room) {
      enterRoom(room)(dispatch, store.getState)
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

  return <></>
}
export default RouterListener
