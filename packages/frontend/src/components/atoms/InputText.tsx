import React, { ChangeEvent } from 'react'
import styled from '@emotion/styled'

export type Props = {
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  errorText?: string
  style?: React.CSSProperties
}

export function InputText({ value, onChange, errorText, style }: Props) {
  return (
    <Wrap style={style} className={errorText ? 'error' : ''}>
      <input type="text" value={value} onChange={onChange} />
      {errorText && <p className="error-txt">{errorText}</p>}
    </Wrap>
  )
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;

  &.error {
    input {
      border: solid 1px var(--color-error);
    }
  }

  input {
    min-height: 28px;
    border-radius: 3px;
    background-color: var(--color-input-background);
    color: var(--color-input);
    resize: none;
    border: none;
    appearance: none;
    font-size: 14px;
    padding: 2px 1em 2px 1em;
    flex: 1;
  }

  .error-txt {
    color: var(--color-error);
    margin: 5px 0 0 0;
    font-weight: 300;
  }
`
