import React, { useEffect, useState, useMemo, useCallback } from 'react'
import styled from '@emotion/styled'
import { Home, Person, ExpandMore } from '@mui/icons-material'
import { useDispatchUi } from '../../contexts/ui/hooks'
import { useRooms, useDispatchRooms } from '../../contexts/rooms/hooks'
import { WIDTH_MOBILE } from '../../lib/constants'
import { ModalUsersList } from './ModalUsersList'

const RoomIcon = ({ iconUrl }: { iconUrl: string }) => {
  return iconUrl ? <img src={iconUrl} /> : <Home fontSize="small" />
}

export const RoomInfo = () => {
  const {
    currentRoomId,
    currentRoomName,
    currentRoomDescription,
    currentRoomIcon,
    openRoomSetting,
    users: { byId }
  } = useRooms()
  const { getUsers, toggleRoomSetting } = useDispatchRooms()
  const { openUserDetail } = useDispatchUi()
  const [open, setOpen] = useState(false)
  const description = useMemo(() => {
    return currentRoomDescription ? currentRoomDescription.substring(0, 20) : ''
  }, [currentRoomDescription])

  const users = byId[currentRoomId]
  const name = currentRoomName || ''

  useEffect(() => {
    if (currentRoomId) {
      getUsers(currentRoomId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoomId])

  const clickUser = (user) => {
    openUserDetail(user.id, user.account, user.icon)
  }

  const userIcons = (users?.users || [])
    .slice(0, 10)
    .map((u, i) => <img key={i} src={u.icon} onClick={() => clickUser(u)} />)

  const expandClassName = ['expand-icon']
  if (openRoomSetting) {
    expandClassName.push('expand')
  }

  const onExpandClick = () => {
    toggleRoomSetting()
  }

  const onClose = useCallback(() => {
    setOpen(false)
  }, [setOpen])

  return (
    <Wrap>
      <div className="room-icon">
        <RoomIcon iconUrl={currentRoomIcon} />
      </div>
      <span className="room-name">{name}</span>
      <div className="divider"></div>
      <span className="room-description">{description}</span>
      <div className="space"></div>
      <div className="room-users">
        <div className="room-users-info" onClick={() => setOpen(true)}>
          <Person />
          <div className="count">{users?.count || 0}</div>
        </div>
        <div className="users">{userIcons}</div>
      </div>
      <div className={expandClassName.join(' ')} onClick={onExpandClick}>
        <ExpandMore className="icon" />
      </div>
      <ModalUsersList open={open} onClose={onClose} roomId={currentRoomId} />
    </Wrap>
  )
}

const Wrap = styled.div`
  display: flex;
  min-height: var(--navi-height);
  padding: 0 16px;
  align-items: center;
  color: var(--color-on-guide);
  border-bottom: 1px solid var(--color-border);

  .space {
    flex: 1;
  }

  .room-icon {
    color: var(--color-on-guide);
    width: 32px;
    height: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
    img {
      width: 20px;
      height: 20px;
    }
  }

  .room-name {
    max-width: 400px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .divider {
    width: 1px;
    height: 60%;
    margin: 0 1em;
    background: var(--color-on-secondary);
  }

  .room-description {
    color: var(--color-on-secondary);
  }

  .room-users {
    display: flex;
    align-items: center;
    .room-users-info {
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
    }
    .count {
      padding: 0 0 0 4px;
    }
    .users {
      min-width: 230px;
      padding: 0 8px;
      display: flex;
      img {
        cursor: pointer;
        padding-left: 3px;
        width: 20px;
        height: 20px;
      }
    }
  }

  .expand-icon {
    display: flex;
    justify-content: center;
    align-items: center;
    transition-duration: 0.5s;

    &.expand {
      transform: rotate(180deg);
    }

    .icon {
      cursor: pointer;
      color: var(--color-on-guide);
      margin: 0 8px 0;
    }
  }

  @media (max-width: ${WIDTH_MOBILE}px) {
    padding: 0 8px;
    .room-users {
      .users {
        display: none;
      }
    }
    .room-description {
      display: none;
    }
  }
`
