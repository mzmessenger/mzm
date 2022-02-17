import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from '@emotion/styled'
import { useDispatchRooms } from '../../contexts/rooms/hooks'
import { useDispatchSocket } from '../../contexts/socket/hooks'
import { Button } from '../atoms/Button'
import { TransparentButton } from '../atoms/Button'
import { ModalProps, ModalBase } from '../atoms/Modal'
import { InputText } from '../atoms/InputText'

type Props = ModalProps

export const ModalCraeteRoom = ({ open, onClose }: Props) => {
  const navigate = useNavigate()
  const [txt, setTxt] = useState('')
  const [error, setErrorTxt] = useState('')
  const { getRooms } = useDispatchSocket()
  const { createRoom } = useDispatchRooms()

  const handleSubmit = (evt) => {
    evt.preventDefault()
    // @todo エラー時の処理
    createRoom(txt, getRooms)
      .then((data) => {
        if (data.status === 200) {
          onClose()
          navigate(`/rooms/${txt}`)
          setTxt('')
          setErrorTxt('')
        } else {
          setErrorTxt('なにかエラーが発生しました')
        }
      })
      .catch(() => {
        setErrorTxt('なにかエラーが発生しました')
      })
  }

  const onChange = (e) => {
    setTxt(e.target.value)
  }

  return (
    <ModalBase open={open} onClose={onClose}>
      <ModalInner onSubmit={handleSubmit}>
        <h4>部屋を作成</h4>
        <div className="body">
          <p style={{ margin: '0 0 3px 0', fontSize: '15px' }}>部屋名</p>
          <InputText value={txt} onChange={onChange} />
          <p style={{ display: error ? 'block' : 'none' }}>{error}</p>
        </div>
        <Buttons>
          <TransparentButton className="cancel" onClick={onClose}>
            キャンセル
          </TransparentButton>
          <Button type="submit">送信</Button>
        </Buttons>
      </ModalInner>
    </ModalBase>
  )
}

const ModalInner = styled.form`
  width: 440px;
  border-radius: 3px;
  background-color: var(--color-background);
  color: var(--color-on-background);
  h4 {
    margin: 0;
    padding: 20px;
  }
  .body {
    padding: 0 20px 20px;
  }
`

const Buttons = styled.div`
  padding: 14px 20px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--color-border);
  button {
    height: 40px;
    width: 100px;
  }
  button.cancel {
    margin-right: 5px;
  }
`
