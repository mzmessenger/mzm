import React, { useState, useCallback } from 'react'
import styled from 'styled-components'
import { useNavigate } from 'react-router-dom'
import { useRooms, useDispatchRooms } from '../contexts/rooms/hooks'
import { Room } from '../contexts/rooms/constants'
import { useDispatchSocket } from '../contexts/socket/hooks'
import { useDispatchUi } from '../contexts/ui/hooks'
import RoomElem from './RoomElem'

const DropZone = ({
  room,
  currentRoomId,
  onDrop,
  onClick
}: {
  room: Room
  currentRoomId: string
  onDrop: (e: React.DragEvent) => void
  onClick: (e: React.MouseEvent, room: Room) => void
}) => {
  const [isOver, setIsOver] = useState(false)

  const onDropWrap = (e: React.DragEvent) => {
    setIsOver(false)
    onDrop(e)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.dataTransfer.dropEffect = 'move'
    setIsOver(true)
    e.preventDefault()
  }

  const onDragLeave = () => setIsOver(false)

  const onDragStart = (e: React.DragEvent, room: Room) => {
    e.dataTransfer.setData('text/plain', room.id)
  }

  const className = isOver ? 'dropzone over' : 'dropzone'

  return (
    <div
      onDrop={onDropWrap}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={className}
      draggable="true"
      onDragStart={(e) => onDragStart(e, room)}
      attr-room-id={room.id}
    >
      <RoomElem
        name={room.name}
        unread={room.unread}
        replied={room.replied}
        iconUrl={room.iconUrl}
        current={room.id === currentRoomId}
        onClick={(e) => onClick(e, room)}
      />
    </div>
  )
}

const Rooms = () => {
  const navigate = useNavigate()
  const {
    rooms: { allIds, byId },
    currentRoomId
  } = useRooms()
  const { changeRoom, changeRoomOrder } = useDispatchRooms()
  const { sortRoom, getMessages, readMessages } = useDispatchSocket()
  const { closeMenu } = useDispatchUi()

  const onClick = useCallback((e: React.MouseEvent, room: Room) => {
    e.preventDefault()
    navigate(`/rooms/${room.name}`)
    changeRoom(room.id, getMessages, closeMenu)
    readMessages(room.id)
  }, [])

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
    [allIds]
  )

  return (
    <Wrap>
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
export default Rooms

const Wrap = styled.div`
  padding: 5px 0;
  cursor: pointer;
  overflow-y: scroll;
  flex: 1;

  .dropzone.over {
    box-shadow: inset 0 2px 2px rgba(255, 100, 100, 0.8);
  }
`
