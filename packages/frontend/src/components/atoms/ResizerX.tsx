import React, { useState, useRef } from 'react'
import styled from '@emotion/styled'

type Props = {
  width: number
  setWidth: (w: number) => void
  style?: React.CSSProperties
}

export const ResizerX: React.FC<Props> = ({ width, setWidth, style }) => {
  const timerRef = useRef(0)
  const [defaultWidth, setDefault] = useState(width)
  const [diff, setDiff] = useState(0)
  const [startX, setStartX] = useState(0)

  const onDragStart = (e: React.DragEvent) => setStartX(e.pageX)

  const onDrag = (e: React.DragEvent) => {
    if (e.clientX !== 0) {
      const currentDiff = startX - e.pageX
      if (diff !== currentDiff) {
        setDiff(currentDiff)
        clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => {
          setWidth(defaultWidth + currentDiff)
        }, 5)
      }
    }
  }
  const onDragEnd = () => {
    const current = defaultWidth + diff
    setDefault(current)
    setWidth(current)
  }

  return (
    <Wrap
      className="resizer-x"
      style={style}
      draggable={true}
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
    ></Wrap>
  )
}

const Wrap = styled.div`
  min-width: 8px;
  height: 100%;
  cursor: col-resize;
  content: '';
  background: 0 0;
  opacity: 0;
`
