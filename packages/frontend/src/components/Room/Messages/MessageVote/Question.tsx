import React, { useState, useEffect, useMemo } from 'react'
import styled from '@emotion/styled'
import { useDispatchSocket } from '../../../../contexts/socket/hooks'
import { useUser } from '../../../../contexts/user/hooks'
import {
  useMessages,
  useDispatchMessages
} from '../../../../contexts/messages/hooks'
import { VoteAnswerTypeEnum } from './constants'
import { VoteAnswer } from './VoteAnswer'
import { VoteAnswerBar } from './VoteAnswerBar'
import { RadioButton } from './RadioButton'

type Props = {
  messageId: string
  text: string
  index: number
}

export const Question: React.FC<Props> = ({ messageId, text, index }) => {
  const { me } = useUser()
  const {
    voteAnswers: { byId }
  } = useMessages()
  const { removeVoteAnswer, sendVoteAnswer } = useDispatchMessages()
  const [checked, setChecked] = useState<number>(null)
  const {
    removeVoteAnswer: removeVoteAnswerSocket,
    sendVoteAnswer: sendVoteAnswerSocket
  } = useDispatchSocket()

  const answers = useMemo(() => {
    return byId[messageId][index] ?? []
  }, [byId, index, messageId])

  const name = `${text}-${index}`

  const ok = answers.filter((e) => e.answer === 0)
  const ng = answers.filter((e) => e.answer === 1)
  const na = answers.filter((e) => e.answer === 2)

  useEffect(() => {
    setChecked(answers.find((e) => e.userId === me.id)?.answer)
  }, [me.id, answers])

  const onClickRadio = (e: React.MouseEvent<HTMLInputElement>) => {
    const answer = parseInt((e.target as HTMLInputElement).value, 10)
    if (answer === checked) {
      removeVoteAnswer(messageId, index, me, removeVoteAnswerSocket)
      setChecked(null)
    } else {
      const answer = parseInt((e.target as HTMLInputElement).value, 10)
      sendVoteAnswer(messageId, index, answer, me, sendVoteAnswerSocket)
      setChecked(answer)
    }
  }

  return (
    <Wrap>
      <form className="question-form">
        <div>
          <p>{text}</p>
        </div>
        <ul className="vote-answer-bar-wrap">
          <VoteAnswerBar
            className="vote-answer-bar ok"
            numerator={ok.length}
            denominator={answers.length}
          />
          <VoteAnswerBar
            className="vote-answer-bar ng"
            numerator={ng.length}
            denominator={answers.length}
          />
          <VoteAnswerBar
            className="vote-answer-bar na"
            numerator={na.length}
            denominator={answers.length}
          />
        </ul>
        <div className="radio-group">
          <RadioButton
            name={name}
            value={0}
            checked={checked}
            onClick={onClickRadio}
          />
          <RadioButton
            name={name}
            value={1}
            checked={checked}
            onClick={onClickRadio}
          />
          <RadioButton
            name={name}
            value={2}
            checked={checked}
            onClick={onClickRadio}
          />
        </div>
      </form>
      <ul className="answers">
        <VoteAnswer type={VoteAnswerTypeEnum.ok} answers={ok} />
        <VoteAnswer type={VoteAnswerTypeEnum.ng} answers={ng} />
        <VoteAnswer type={VoteAnswerTypeEnum.na} answers={na} />
      </ul>
    </Wrap>
  )
}

const Wrap = styled.div`
  max-width: 240px;
  min-width: 210px;
  border: 1px solid var(--color-border);
  padding: 0 1em;

  .question-form {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .vote-answer-bar-wrap {
    height: 2px;
    width: 180px;
    background: #e6eaef;
    list-style-type: none;
    position: relative;
    margin: 0;
    padding: 0;
  }

  .vote-answer-bar {
    display: inline-block;
    height: 2px;
    vertical-align: top;
  }

  .vote-answer-bar.ok {
    background: var(--color-vote-ok);
  }
  .vote-answer-bar.ng {
    background: var(--color-vote-ng);
  }
  .vote-answer-bar.na {
    background: var(--color-vote-na);
  }

  .answers {
    list-style: none;
    padding: 0;
    max-width: 240px;
  }

  .radio-group {
    display: inline-flex;
    justify-content: space-between;
    margin: 1rem 0 0 0;
    height: 100%;
  }
`
