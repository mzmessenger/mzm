import React from 'react'
import styled from '@emotion/styled'
import CheckIcon from '@mui/icons-material/Check'
import { useAuth } from '../../../recoil/auth/hooks'
import {
  useRoomActions,
  useCurrentRoom,
  useRoomById
} from '../../../recoil/rooms/hooks'
import { useSocketActions } from '../../../recoil/socket/hooks'

export const SettingRoomStatus = () => {
  const { currentRoomId } = useCurrentRoom()
  const { getAccessToken } = useAuth()
  const { setRoomStatus } = useRoomActions({ getAccessToken })
  const { openRoom, closeRoom } = useSocketActions()
  const room = useRoomById(currentRoomId)
  const status = room?.status

  const clickOpen = () => {
    openRoom(currentRoomId)
    setRoomStatus(currentRoomId, 'open')
  }

  const clickClose = () => {
    closeRoom(currentRoomId)
    setRoomStatus(currentRoomId, 'close')
  }

  return (
    <Wrap>
      <h4>公開設定</h4>
      <ul>
        <li>
          <div
            className={status === 'open' ? 'active' : ''}
            onClick={clickOpen}
          >
            <CheckIcon />
            公開
          </div>
        </li>
        <li>
          <div
            className={status === 'close' ? 'active' : ''}
            onClick={clickClose}
          >
            <CheckIcon />
            非公開
          </div>
        </li>
      </ul>
    </Wrap>
  )
}

const Wrap = styled.div`
  margin-top: 16px;

  > ul {
    list-style-type: none;
    margin: 0;
    padding: 0;
    > li {
      > div {
        display: flex;
        align-items: center;
        cursor: pointer;
      }
      padding-left: 0;
      margin: 1em 0;
    }
  }
  svg {
    opacity: 0;
    margin: 0 0.5em 0 0;
    color: #50e9a3;
  }
  .active {
    svg {
      opacity: 1;
    }
  }
`
