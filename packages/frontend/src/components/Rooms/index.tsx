import React, { useCallback } from 'react'
import styled from '@emotion/styled'
import { useNavigate } from 'react-router-dom'
import { useRooms, useDispatchRooms } from '../../contexts/rooms/hooks'
import { Room } from '../../contexts/rooms/constants'
import { useSocket } from '../../recoil/socket/hooks'
import { useUi } from '../../recoil/ui/hooks'
import { DropZone } from './DropZone'

export const Rooms = () => {
  const navigate = useNavigate()
  const {
    rooms: { allIds, byId },
    currentRoomId
  } = useRooms()
  const { changeRoom, changeRoomOrder } = useDispatchRooms()
  const { sortRoom, getMessages, readMessages } = useSocket()
  const { closeMenu } = useUi()

  const onClick = useCallback(
    (e: React.MouseEvent, room: Room) => {
      e.preventDefault()
      navigate(`/rooms/${room.name}`)
      changeRoom(room.id, getMessages, closeMenu)
      readMessages(room.id)
    },
    [changeRoom, closeMenu, getMessages, navigate, readMessages]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()

      const moveId = e.dataTransfer.getData('text')
      const roomOrder = [
        ...allIds.filter((e, i) => i !== allIds.indexOf(moveId))
      ]
      roomOrder.splice(
        allIds.indexOf(e.currentTarget.getAttribute('attr-room-id')),
        0,
        moveId
      )

      changeRoomOrder(roomOrder, sortRoom)

      e.dataTransfer.clearData()
    },
    [allIds, changeRoomOrder, sortRoom]
  )

  return (
    <Wrap className="scroll-styled-y">
      {allIds.map((r) => (
        <DropZone
          key={r}
          room={byId[r]}
          currentRoomId={currentRoomId}
          onDrop={onDrop}
          onClick={onClick}
        />
      ))}
    </Wrap>
  )
}

const Wrap = styled.div`
  padding: 5px 0;
  cursor: pointer;
  overflow-y: scroll;
  flex: 1;

  .dropzone.over {
    box-shadow: inset 0 2px 2px rgba(255, 100, 100, 0.8);
  }
`
