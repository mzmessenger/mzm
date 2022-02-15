import React, { lazy } from 'react'
import styled from '@emotion/styled'
import { useRooms } from '../contexts/rooms/hooks'
import InputArea from './InputArea'
import Messages from './Messages'
import RoomInfo from './RoomInfo'

const ContentMessage = () => {
  return (
    <>
      <div className="messages">
        <Messages className="messages-inner" />
      </div>
      <InputArea />
    </>
  )
}

const RoomContent = () => {
  const { openRoomSetting } = useRooms()
  const SettingRoom = lazy(() => import('./SettingRoom'))

  return (
    <Wrap className="room-content">
      <RoomInfo />
      {openRoomSetting ? <SettingRoom /> : <ContentMessage />}
    </Wrap>
  )
}
export default RoomContent

const Wrap = styled.div`
  flex: 1;
  max-width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);

  .messages {
    display: flex;
    overflow: hidden;
    flex-direction: column;
    justify-content: flex-end;
    height: 100%;
    background: var(--color-base);
    .messages-inner {
      overflow: auto;
    }
  }
`
