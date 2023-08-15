import React, { MouseEventHandler } from 'react'
import ListIcon from '@mui/icons-material/List'
import styled from '@emotion/styled'

type Props = {
  className?: string
  onClick: MouseEventHandler<HTMLElement>
}

export function MobileMenuIcon({ className, onClick }: Props) {
  return (
    <Wrap className={className} onClick={onClick}>
      <ListIcon />
    </Wrap>
  )
}

const Wrap = styled.header`
  padding: 8px;
  cursor: pointer;
`
