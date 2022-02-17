import styled from '@emotion/styled'

export const Button = styled.button`
  background-color: var(--color-primary);
  border: none;
  color: var(--color-on-primary);
  border-radius: 3px;
`

export const IconButton = styled.button`
  appearance: none;
  background: none;
  border: 0;
  border-radius: 50%;
  color: inherit;
  cursor: pointer;
  padding: 2px;
  &:hover {
    background: rgba(0, 0, 0, 0.2);
    transition: background-color 0.1s ease-in;
  }
`

export const TransparentButton = styled.button`
  background-color: transparent;
  border: none;
  color: var(--color-on-primary);
  border-radius: 3px;
`
