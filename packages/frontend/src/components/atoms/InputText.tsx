import React, { ChangeEvent } from 'react'
import styled from '@emotion/styled'

export type Props = {
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  error?: boolean
  style?: React.CSSProperties
}

export const InputText: React.FC<Props> = ({
  value,
  onChange,
  error,
  style
}) => {
  return (
    <Wrap style={style} className={error ? 'error' : ''}>
      <input type="text" value={value} onChange={onChange} />
    </Wrap>
  )
}

const Wrap = styled.div`
  display: flex;
  min-height: 40px;

  &.error {
    border: solid 1px var(--color-error);
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
`
