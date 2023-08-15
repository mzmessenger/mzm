import React from 'react'
import styled from '@emotion/styled'
import { VoteAnswerType } from '../../../../recoil/messages/hooks'
import { VoteAnswerTypeEnum } from './constants'

type Props = {
  className?: string
  type: (typeof VoteAnswerTypeEnum)[keyof typeof VoteAnswerTypeEnum]
  answers: VoteAnswerType[]
}

export const VoteAnswer: React.FC<Props> = ({ className, type, answers }) => {
  const typeClass =
    type === VoteAnswerTypeEnum.ok
      ? 'ok'
      : type === VoteAnswerTypeEnum.ng
      ? 'ng'
      : type === VoteAnswerTypeEnum.na
      ? 'na'
      : ''

  return (
    <Wrap className={className}>
      <div className="info">
        <span className={`type ${typeClass}`}>{type}</span>
        <span className="num">{answers.length}</span>
      </div>
      <div className="users">
        {answers.map((e) => (
          <div key={e.userId}>
            <img src={e.icon} width="24" height="24" crossOrigin="anonymous" />
          </div>
        ))}
      </div>
    </Wrap>
  )
}

const Wrap = styled.li`
  display: flex;
  min-height: 24px;
  margin-top: 8px;

  .info {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .num {
    width: 1.7em;
    text-align: center;
  }

  .type {
    width: 1em;
    font-weight: 700;
    font-size: 1rem;
    text-align: center;
  }

  .type.ok {
    color: var(--color-vote-ok);
  }
  .type.ng {
    color: var(--color-vote-ng);
  }
  .type.na {
    color: var(--color-vote-na);
  }

  .users {
    display: flex;
    flex-wrap: wrap;
  }
`
