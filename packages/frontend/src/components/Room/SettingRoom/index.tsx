import React from 'react'
import styled from '@emotion/styled'
import { Home, DirectionsRun } from '@mui/icons-material'
import { WIDTH_MOBILE } from '../../../lib/constants'
import { DropImage } from '../../atoms/DropImage'
import { Button } from '../../atoms/Button'
import { ModalIcon } from '../../atoms/ModalIcon'
import { useSettiongRooms } from './index.hooks'
import { SettingRoomStatus } from './RoomStatus'
import { RoomInfo } from './RoomInfo'

const IconImage = ({ iconUrl }: { iconUrl: string }) => {
  return iconUrl ? <img src={iconUrl} /> : <Home />
}

export const SettingRoom = () => {
  const {
    id,
    name,
    description,
    iconUrl,
    isGeneral,
    image,
    open,
    edit,
    onExit,
    onLoadFile,
    onModalSave,
    onModalCancel,
    onEdit,
    onSave,
    onCancel,
    onChangeDescription
  } = useSettiongRooms()

  return (
    <Wrap>
      <div className="inner">
        <h2>部屋設定</h2>
        <div className="room-wrap">
          <div className="room-body">
            <div className="room-icon">
              {edit && <DropImage onloadFile={onLoadFile} />}
              {!edit && <IconImage iconUrl={iconUrl} />}
            </div>
            <RoomInfo
              id={id}
              name={name}
              description={description}
              edit={edit}
              onChangeDescription={onChangeDescription}
            />
            <div className="button">
              {edit && (
                <>
                  <Button className="cancel" onClick={onCancel}>
                    キャンセル
                  </Button>
                  <Button className="save" onClick={onSave}>
                    保存
                  </Button>
                </>
              )}
              {!edit && (
                <Button className="edit" onClick={onEdit}>
                  編集
                </Button>
              )}
            </div>
          </div>

          {!isGeneral && (
            <div className="room-status">
              <SettingRoomStatus />
            </div>
          )}
          {!isGeneral && (
            <div className="exit" onClick={onExit}>
              <Button>
                <DirectionsRun className="icon" />
                退室する
              </Button>
            </div>
          )}
        </div>
      </div>
      <ModalIcon
        image={image}
        open={open}
        onSave={onModalSave}
        onCancel={onModalCancel}
      />
    </Wrap>
  )
}

const Wrap = styled.div`
  padding: 8px 32px;
  color: var(--color-on-background);

  .inner {
    background: var(--color-surface);
    color: var(--color-on-surface);
    padding: 8px 16px;
  }

  .room-wrap {
    padding: 32px 0 32px;
    border-top: 1px solid var(--color-border);
  }

  .room-body {
    display: flex;
  }

  .room-icon {
    .drop,
    > svg,
    img {
      padding: 4px;
      width: 100px;
      height: 100px;
    }

    > svg,
    img {
      border: 1px solid var(--color-border);
      border-radius: 4px;
    }
  }

  .button {
    display: flex;
    flex-direction: column;

    button {
      width: 100px;
      height: 32px;
    }
    .cancel {
      background: none;
    }
    .save {
      margin: 1em 0 0 0;
    }
  }

  .room-status,
  .exit {
    border-top: 1px solid var(--color-border);
    margin-top: 32px;
  }

  .exit {
    .icon {
      margin-right: 8px;
    }

    button {
      margin-top: 16px;
      padding: 0 16px;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 32px;
      color: var(--color-warning);
      border: 1px solid var(--color-warning);
      background: none;
    }
  }

  @media (max-width: ${WIDTH_MOBILE}px) {
    padding-left: 0;
    padding-right: 0;
  }
`
