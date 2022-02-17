import React from 'react'
import styled from '@emotion/styled'
import { VoteAnswerTypeEnum } from './constants'

type Props = {
  name: string
  value: 0 | 1 | 2
  checked: number
  onClick: React.MouseEventHandler<HTMLInputElement>
}

export const RadioButton: React.FC<Props> = ({
  name,
  value,
  checked,
  onClick
}) => {
  const checkedFlg = checked === value
  const type =
    value === 0
      ? VoteAnswerTypeEnum.ok
      : value === 1
      ? VoteAnswerTypeEnum.ng
      : value === 2
      ? VoteAnswerTypeEnum.na
      : ''

  return (
    <Wrap>
      <input
        type="radio"
        value={value}
        name={name}
        defaultChecked={checkedFlg}
        onClick={onClick}
      />
      <span className={checkedFlg ? 'checked' : ''}>{type}</span>
    </Wrap>
  )
}

const Wrap = styled.label`
  display: flex;
  align-items: center;
  width: 32px;
  height: 32px;

  input[type='radio'] {
    display: none;
  }

  span.checked {
    background: #b54a4a;
    text-shadow: 0 0 1px rgba(0, 0, 0, 0.7);
  }

  span {
    cursor: pointer;
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 3px;
    background: var(--color-background-secondary);
    color: var(--color-on-background-secondary);
    width: 100%;
    height: 100%;
  }
`
