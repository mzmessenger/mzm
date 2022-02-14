import React from 'react'
import styled from 'styled-components'
import { useDispatchUser } from '../contexts/user/hooks'
import Button from './atoms/Button'
import SettingAccount from './SettingAccount'

const SettingUser = () => {
  const { removeUser } = useDispatchUser()

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
export default SettingUser

const Wrap = styled.div`
  .delete {
    margin-top: 32px;
    button {
      height: 32px;
      padding: 0 16px;
      color: var(--color-warning);
      border: 1px solid var(--color-warning);
      background: none;
    }
  }
`
