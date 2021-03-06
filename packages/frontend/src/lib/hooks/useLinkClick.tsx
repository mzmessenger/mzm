import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatchRooms } from '../../contexts/rooms/hooks'
import { useDispatchSocket } from '../../contexts/socket/hooks'
import { useDispatchUi } from '../../contexts/ui/hooks'
import { getRoomName } from '../util'

export const useLinkClick = () => {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { enterRoom } = useDispatchRooms()
  const { getMessages, enterRoom: enterRoomSocket } = useDispatchSocket()
  const { closeMenu } = useDispatchUi()

  useEffect(() => {
    if (!ref.current) {
      return
    }
    const listener = (e) => {
      const href = e.target.getAttribute('href')
      const url = new URL(href)
      if (url.host === window.location.host) {
        navigate(url.pathname)
        const roomName = getRoomName(url.pathname)
        enterRoom(roomName, getMessages, enterRoomSocket, closeMenu)
      } else {
        window.open(url.href, '_blank')
      }

      e.preventDefault()
      e.stopPropagation()
    }
    ref.current
      .querySelectorAll('a')
      .forEach((e) => e.addEventListener('click', listener))
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ref.current
        ?.querySelectorAll('a')
        .forEach((e) => e.removeEventListener('click', listener))
    }
  }, [closeMenu, enterRoom, enterRoomSocket, getMessages, ref, navigate])

  return [ref] as const
}
