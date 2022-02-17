import React, { useState, useCallback } from 'react'
import { Room } from '../../contexts/rooms/constants'
import { RoomElem } from './RoomElem'

type Props = {
  room: Room
  currentRoomId: string
  onDrop: (e: React.DragEvent) => void
  onClick: (e: React.MouseEvent, room: Room) => void
}

export const DropZone: React.FC<Props> = ({
  room,
  currentRoomId,
  onDrop,
  onClick
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
