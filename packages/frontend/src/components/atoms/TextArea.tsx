import React, { ChangeEvent, KeyboardEvent, forwardRef } from 'react'
import styled from '@emotion/styled'

export type Props = {
  value: string
  rows?: number
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  style?: React.CSSProperties
  className?: string
}

export const TextArea = forwardRef<HTMLTextAreaElement, Props>(
  (
    {
      value,
      rows = 1,
      onChange = () => {},
      onKeyDown = () => {},
      style = {},
      className = ''
    },
    ref
  ) => {
    return (
      <Wrap style={style} className={className}>
        <textarea
          rows={rows}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          ref={ref}
        />
      </Wrap>
    )
  }
)

const Wrap = styled.div`
  border-radius: 5px;
  display: flex;
  background-color: var(--color-input-background);
  display: flex;

  textarea {
    min-height: 2em;
    color: var(--color-input);
    background-color: transparent;
    font-size: 14px;
    resize: none;
    border: none;
    appearance: none;
    padding: 10px;
    flex: 1;
  }
`
