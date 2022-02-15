import React from 'react'
import styled from '@emotion/styled'
import Modal from '@mui/material/Modal'

export type ModalProps = {
  open: boolean
  style?: React.CSSProperties
  onClose: () => void
}

const ModalBase = ({
  open,
  style,
  onClose,
  children
}: ModalProps & { children?: React.ReactNode }) => {
  return (
    <Modal open={open} onClose={onClose}>
      <ModalInner style={style}>{children}</ModalInner>
    </Modal>
  )
}
export default ModalBase

const ModalInner = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translateY(-50%) translateX(-50%);
  margin: auto;
  box-shadow: 0px 3px 5px -1px rgba(0, 0, 0, 0.2),
    0px 5px 8px 0px rgba(0, 0, 0, 0.14), 0px 1px 14px 0px rgba(0, 0, 0, 0.12);
  outline: none;
`
