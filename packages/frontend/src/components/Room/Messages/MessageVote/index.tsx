import React from 'react'
import styled from '@emotion/styled'
import { type StateMessageType } from '../../../../state/messages/hooks'
import { Question } from './Question'

type Props = {
  className?: string
  messageId: string
  vote?: StateMessageType['vote']
}

export const MessageVote: React.FC<Props> = ({
  messageId,
  className,
  vote
}) => {
  return (
    <Wrap className={className}>
      {vote.questions.map((q, i) => (
        <Question messageId={messageId} key={i} text={q.text} index={i} />
      ))}
    </Wrap>
  )
}

const Wrap = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, 240px);
  grid-auto-flow: row;
  column-gap: 1em;
  row-gap: 1em;

  min-width: 200px;
`
