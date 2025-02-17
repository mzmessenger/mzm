import React, { useMemo } from 'react'
import { useNavigate } from 'react-router'
import styled from '@emotion/styled'
import { Home, Forward } from '@mui/icons-material'
import { useEnterRoomActions } from '../../state/rooms/hooks'
import { useSocketActions } from '../../state/socket/hooks'
import { useUiActions } from '../../state/ui/hooks'
import { useSearch } from '../../state/search/hooks'
import { IconButton } from '../atoms/Button'

export const SearchRoomElement: React.FC<{
  name: string
  iconUrl: string
  description?: string
}> = (props) => {
  const navigate = useNavigate()
  const { getMessages, enterRoom: enterRoomSocket } = useSocketActions()
  const { cancel } = useSearch()
  const { closeMenu } = useUiActions()
  const { enterRoom } = useEnterRoomActions({
    getMessages,
    closeMenu,
    enterRoomSocket
  })

  const description = useMemo(() => {
    return props.description ? props.description.substring(0, 40) : ''
  }, [props.description])

  const onClick = () => {
    enterRoom(props.name).then(() => {
      navigate(`/rooms/${props.name}`)
      cancel()
    })
  }

  return (
    <RoomWrap className="search-room-elem">
      <div className="room-info">
        <div className="room-icon">
          {props.iconUrl ? (
            <img src={props.iconUrl} crossOrigin="anonymous" />
          ) : (
            <Home />
          )}
        </div>
        <div className="room-name">{props.name}</div>
        <div className="divider"></div>
        <div className="room-description">{description}</div>
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
    min-width: 100px;
  }

  .divider {
    width: 1px;
    height: 60%;
    margin: 0 1em;
    background: var(--color-on-secondary);
  }

  .room-description {
    flex: 1;
  }

  .buttons {
    display: flex;
    justify-content: center;
  }
`
