import React, { useState, useCallback } from 'react'
import styled from '@emotion/styled'
import Add from '@mui/icons-material/Add'
import { ModalCraeteRoom } from './ModalCreateRoom'

export const RoomNavi = () => {
  const [modal, setModal] = useState(false)

  const onClose = useCallback(() => {
    setModal(false)
  }, [])

  return (
    <Wrap>
      <div style={{ display: 'flex' }} onClick={() => setModal(true)}>
        <Add style={{ fontSize: '20px', marginRight: '3px' }} />
        <div style={{ fontSize: '16px', lineHeight: '20px' }}>部屋追加</div>
      </div>
      <ModalCraeteRoom open={modal} onClose={onClose} />
    </Wrap>
  )
}

const Wrap = styled.div`
  display: flex;
  align-items: center;
  padding: 0 10px;
  height: var(--navi-height);
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
`
