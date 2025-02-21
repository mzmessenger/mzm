import React from 'react'
import styled from '@emotion/styled'
import Clear from '@mui/icons-material/Clear'
import { ModalBase } from './atoms/Modal'
import { IconButton } from './atoms/Button'
import { WIDTH_MOBILE } from '../constants'
import { useUiActions, useUserDetailUi } from '../state/ui/hooks'

export const ModalUserProfile: React.FC = () => {
  const { closeUserDetail } = useUiActions()
  const { userDetail, isOpenUserDetail } = useUserDetailUi()

  const onClose = () => {
    closeUserDetail()
  }

  if (!isOpenUserDetail) {
    return <></>
  }

  return (
    <ModalBase open={isOpenUserDetail} onClose={onClose}>
      <ModalInner>
        <header>
          <IconButton className="close" onClick={onClose}>
            <Clear />
          </IconButton>
        </header>
        <div className="icon">
          <img src={userDetail.icon} crossOrigin="anonymous" />
        </div>
        <div className="account">{userDetail.account}</div>
      </ModalInner>
    </ModalBase>
  )
}

const ModalInner = styled.div`
  max-width: 440px;
  min-width: 400px;
  border-radius: 5px;
  background-color: var(--color-background);
  color: var(--color-on-background);

  header {
    display: flex;
    justify-content: flex-end;
    height: 48px;
    background-color: var(--color-base);
    .close {
      margin-right: 0.5em;
    }
  }

  .icon {
    position: absolute;
    top: 16px;
    left: 16px;
    img {
      width: 64px;
      height: 64px;
    }
  }

  .account {
    margin-top: 32px;
    padding: 1em 1em;
  }

  @container page-container (max-width: ${WIDTH_MOBILE}px) {
    min-width: 80vw;
    max-width: 80vw;
  }
`
