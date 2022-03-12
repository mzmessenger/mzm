import React, { ChangeEvent } from 'react'
import styled from '@emotion/styled'

export type Props = {
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  errorText?: string
  style?: React.CSSProperties
}

export const InputText: React.FC<Props> = ({
  value,
  onChange,
  errorText,
  style
}) => {
  return (
    <Wrap style={style} className={errorText ? 'error' : ''}>
      <input type="text" value={value} onChange={onChange} />
      {errorText && <p className="error-txt">{errorText}</p>}
    </Wrap>
  )
}

const Wrap = styled.div`
  min-height: 40px;

  &.error {
    input {
      border: solid 1px var(--color-error);
    }
  }

  input {
    border-radius: 3px;
    background-color: var(--color-input-background);
    color: var(--color-input);
    resize: none;
    border: none;
    appearance: none;
    font-size: 14px;
    padding: 2px 1em 2px 1em;
    height: 28px;
    flex: 1;
  }

  .error-txt {
    color: var(--color-error);
    margin: 5px 0 0 0;
    font-weight: 300;
  }
`
