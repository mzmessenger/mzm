import React from 'react'
import styled from '@emotion/styled'
import { Clear } from '@mui/icons-material'
import { InputText } from '../../atoms/InputText'

export const Question: React.FC<{
  value: string
  showClearButton: boolean
  onChange: (e) => void
  onClear: (e) => void
}> = ({ value, showClearButton, onChange, onClear }) => {
  return (
    <QuestionWrap>
      <InputText
        style={{ margin: '0 8px 0 0' }}
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
