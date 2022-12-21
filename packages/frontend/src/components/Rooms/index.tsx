import type { Room } from '../../recoil/rooms/types'
import React, { useCallback } from 'react'
import styled from '@emotion/styled'
import { useNavigate } from 'react-router-dom'
import {
  useChangeRoomActions,
  useCurrentRoom,
  useRoomsAllIds
} from '../../recoil/rooms/hooks'
import { useSocketActions } from '../../recoil/socket/hooks'
import { useUiActions } from '../../recoil/ui/hooks'
import { DropZone } from './DropZone'

export const Rooms = () => {
  const navigate = useNavigate()
  const roomsAllIds = useRoomsAllIds()
  const { currentRoomId } = useCurrentRoom()
  const { changeRoom, changeRoomOrder } = useChangeRoomActions()
  const { sortRoom, getMessages, readMessages } = useSocketActions()
  const { closeMenu } = useUiActions()

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
        ...roomsAllIds.filter((e, i) => i !== roomsAllIds.indexOf(moveId))
      ]
      roomOrder.splice(
        roomsAllIds.indexOf(e.currentTarget.getAttribute('attr-room-id')),
        0,
        moveId
      )

      changeRoomOrder(roomOrder, sortRoom)

      e.dataTransfer.clearData()
    },
    [roomsAllIds, changeRoomOrder, sortRoom]
  )

  return (
    <Wrap className="scroll-styled-y">
      {roomsAllIds.map((r) => {
        return (
          <DropZone
            key={r}
            roomId={r}
            currentRoomId={currentRoomId}
            onDrop={onDrop}
            onClick={onClick}
          />
        )
      })}
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
