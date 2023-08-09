import React, { type ChangeEventHandler, type MouseEventHandler } from 'react'
import styled from '@emotion/styled'
import { Clear } from '@mui/icons-material'
import { InputText } from '../../../atoms/InputText'

export type Props = {
  value: string
  showClearButton: boolean
  onChange: ChangeEventHandler<HTMLInputElement>
  onClear: MouseEventHandler<HTMLButtonElement>
}

export function Question({ value, showClearButton, onChange, onClear }: Props) {
  return (
    <QuestionWrap>
      <InputText
        style={{ margin: '0 8px 0 0', flex: 1 }}
        value={value}
        onChange={onChange}
      />
      {showClearButton && (
        <button className="clear-button" onClick={onClear}>
          <Clear />
        </button>
      )}
    </QuestionWrap>
  )
}

const QuestionWrap = styled.div`
  display: flex;
  align-items: center;
  margin: 0 0 4px 0;

  .clear-button {
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: transparent;
    border: none;
    color: var(--color-on-primary);
  }
`
