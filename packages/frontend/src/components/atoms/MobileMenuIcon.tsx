import React from 'react'
import ListIcon from '@mui/icons-material/List'
import styled from '@emotion/styled'

type Props = {
  className?: string
  onClick
}

export const MobileMenuIcon: React.FC<Props> = ({ className, onClick }) => {
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
