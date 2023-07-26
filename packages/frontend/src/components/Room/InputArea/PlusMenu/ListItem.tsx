import React from 'react'
import styled from '@emotion/styled'

type Props = {
  icon: React.ReactNode
  text: string
}

export default function ListItem(props: Props) {
  return (
    <Wrap>
      <div className="icon">{props.icon}</div>
      <span className="text">{props.text}</span>
    </Wrap>
  )
}

const Wrap = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;

  .icon {
    width: 24px;
    margin-right: 1em;
    display: flex;
    justify-content: center;
    align-items: center;
  }
`
