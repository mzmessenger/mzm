import React from 'react'
import { useNavigate } from 'react-router-dom'
import styled from '@emotion/styled'
import { Home, Forward } from '@mui/icons-material'
import { useDispatchRooms } from '../../contexts/rooms/hooks'
import { useDispatchSocket } from '../../contexts/socket/hooks'
import { useDispatchUi } from '../../contexts/ui/hooks'
import { useDispatchSearch } from '../../contexts/search/hooks'
import { IconButton } from '../atoms/Button'

export const SearchRoomElement: React.FC<{
  name: string
  iconUrl: string
}> = ({ name, iconUrl }) => {
  const navigate = useNavigate()
  const { enterRoom } = useDispatchRooms()
  const { getMessages, enterRoom: enterRoomSocket } = useDispatchSocket()
  const { cancel } = useDispatchSearch()
  const { closeMenu } = useDispatchUi()
  const onClick = () => {
    enterRoom(name, getMessages, enterRoomSocket, closeMenu).then(() => {
      navigate(`/rooms/${name}`)
      cancel()
    })
  }

  return (
    <RoomWrap className="search-room-elem">
      <div className="room-info">
        <div className="room-icon">
          {iconUrl ? <img src={iconUrl} /> : <Home />}
        </div>
        <div className="room-name">{name}</div>
      </div>
      <div className="buttons">
        <IconButton onClick={onClick}>
          <Forward />
        </IconButton>
      </div>
    </RoomWrap>
  )
}

const RoomWrap = styled.div`
  padding: 4px 8px 0;
  display: flex;
  &:last-of-type {
    padding-bottom: 4px;
  }

  color: var(--color-on-surface);

  .room-info {
    display: flex;
    flex: 1;
    align-items: center;
  }

  .room-icon {
    width: 32px;
    height: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0 8px 0 0;
    img {
      max-height: 100%;
      max-width: 100%;
    }
  }

  .room-name {
    flex: 1;
  }

  .buttons {
    display: flex;
    justify-content: center;
  }
`
