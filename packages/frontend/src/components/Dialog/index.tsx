import React, {
  forwardRef,
  type MouseEventHandler,
  type MutableRefObject
} from 'react'
import styled from '@emotion/styled'

type Props = {
  onClose?: () => void
  children: React.ReactNode
}

export function Dialog(props: Props, ref: MutableRefObject<HTMLDialogElement>) {
  const onClick: MouseEventHandler<HTMLDialogElement> = (e) => {
    const rect = ref.current.getBoundingClientRect()
    const inner =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width
    if (!inner) {
      ref.current.close()
      props.onClose && props.onClose()
    }
  }
  return (
    <Wrap ref={ref} onClick={onClick}>
      {props.children}
    </Wrap>
  )
}
export default forwardRef(Dialog)

const Wrap = styled.dialog`
  padding: 0;
  background: var(--color-background);
  color: var(--color-on-surface);
  border: solid 1px var(--color-base);
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(4, 4, 5, 0.15);
`
