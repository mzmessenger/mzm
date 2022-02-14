import React from 'react'
import ListIcon from '@mui/icons-material/List'
import styled from 'styled-components'

const MobileMenuIcon = ({
  className,
  onClick
}: {
  className?: string
  onClick
}) => {
  return (
    <Wrap className={className} onClick={onClick}>
      <ListIcon />
    </Wrap>
  )
}
export default MobileMenuIcon

const Wrap = styled.header`
  padding: 8px;
  cursor: pointer;
`
