import React, { useRef, useEffect } from 'react'
import styled from '@emotion/styled'
import { useDispatchSocket } from '../../../contexts/socket/hooks'
import { useRooms } from '../../../contexts/rooms/hooks'
import { MessageElement } from './Message'

export const Messages = ({ className }) => {
  const {
    currentRoomId,
    rooms: { byId },
    scrollTargetIndex
  } = useRooms()
  const currentRoom = byId[currentRoomId]
  const wrapRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef(0)
  const { getHistory } = useDispatchSocket()

  const messages = currentRoom?.messages || []

  const logFlg = messages.length > 0 && currentRoom.existHistory

  const messageElements = messages.map((m) => {
    return (
      <div className="message" key={m}>
        <MessageElement id={m} />
      </div>
    )
  })

  useEffect(() => {
    if (!scrollTargetIndex) {
      return
    }
    if (scrollTargetIndex === 'bottom') {
      bottomRef.current.scrollIntoView()
    } else if (typeof scrollTargetIndex === 'number') {
      const target = logFlg ? scrollTargetIndex + 1 : scrollTargetIndex
      const dom = wrapRef.current.querySelector(`.message:nth-child(${target})`)
      if (dom) {
        dom.scrollIntoView()
      }
    }
  }, [logFlg, messages.length, scrollTargetIndex])

  const onScroll = () => {
    if (!logFlg) {
      return
    }
    clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      const wrapRect = wrapRef.current.getBoundingClientRect()
      const topRect = topRef.current.getBoundingClientRect()
      const margin = 10
      if (wrapRect.top - topRect.bottom <= margin) {
        const oldestId = currentRoom.messages[0]
        getHistory(oldestId, currentRoomId)
      }
    }, 300)
  }

  return (
    <Wrap ref={wrapRef} className={className} onScroll={onScroll}>
      <div ref={topRef} style={{ visibility: 'hidden' }} />
      {messageElements}
      <div ref={bottomRef} style={{ visibility: 'hidden' }} />
    </Wrap>
  )
}

const Wrap = styled.div`
  .message {
    background: var(--color-background);
    margin: 4px;
    :forst-of-type {
      margin-top: 0;
    }
    :last-of-type {
      margin-bottom: 0;
    }
  }
`
