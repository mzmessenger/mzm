import React from 'react'
import styled from '@emotion/styled'
import { useOpenRoomSettingFlag } from '../../state/rooms/hooks'
import { InputArea } from './InputArea'
import { Messages } from './Messages'
import { RoomInfo } from './RoomInfo'
import { SettingRoom } from './SettingRoom'

const ContentMessage = () => {
  return (
    <>
      <div className="messages">
        <Messages className="messages-inner scroll-styled-y" />
      </div>
      <InputArea />
    </>
  )
}

export const RoomContent = () => {
  const openRoomSetting = useOpenRoomSettingFlag()

  return (
    <Wrap className="room-content">
      <RoomInfo />
      {openRoomSetting ? <SettingRoom /> : <ContentMessage />}
    </Wrap>
  )
}

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
