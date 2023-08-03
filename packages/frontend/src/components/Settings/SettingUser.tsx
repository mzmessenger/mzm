import React from 'react'
import styled from '@emotion/styled'
import { useAuth } from '../../recoil/auth/hooks'
import { useRemoveUserActions } from '../../recoil/user/hooks'
import { Button } from '../atoms/Button'
import { SettingAccount } from './SettingAccount'

export const SettingUser = () => {
  const { logout } = useAuth()
  const { removeUser } = useRemoveUserActions({ logout })

  const onDelete = () => {
    if (window.confirm('本当にアカウントを削除しますか？')) {
      removeUser()
    }
  }

  return (
    <Wrap>
      <SettingAccount />
      <div className="delete">
        <Button onClick={onDelete}>アカウントの削除</Button>
      </div>
    </Wrap>
  )
}

const Wrap = styled.div`
  .delete {
    margin-top: 32px;
    padding: 1em 1em 0 1em;
    button {
      height: 32px;
      padding: 0 16px;
      color: var(--color-warning);
      border: 1px solid var(--color-warning);
      background: none;
    }
  }
`
