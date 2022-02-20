import React, { useRef, useEffect, useMemo } from 'react'
import styled from '@emotion/styled'
import { useDispatchSocket } from '../../../contexts/socket/hooks'
import { useRooms } from '../../../contexts/rooms/hooks'
import { useIntersectionObserver } from '../../../lib/hooks/useIntersectionObserver'
import { MessageElement } from './Message'

export const Messages = ({ className }) => {
  const {
    currentRoomId,
    rooms: {
      byId: { [currentRoomId]: currentRoom }
    },
    scrollTargetIndex
  } = useRooms()
  const wrapRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef(0)
  const { getHistory } = useDispatchSocket()

  const [intersectionRef, isIntersecting] = useIntersectionObserver()

  const messages = useMemo(() => {
    return currentRoom?.messages || []
  }, [currentRoom?.messages])

  const existHistoryFlg = useMemo(() => {
    return messages.length > 0 && currentRoom.existHistory
  }, [currentRoom.existHistory, messages.length])

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
      const target = existHistoryFlg ? scrollTargetIndex + 1 : scrollTargetIndex
      const dom = wrapRef.current.querySelector(`.message:nth-child(${target})`)
      if (dom) {
        dom.scrollIntoView()
      }
    }
  }, [existHistoryFlg, messages.length, scrollTargetIndex])

  useEffect(() => {
    if (!isIntersecting || !existHistoryFlg) {
      return
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => {
      const oldestId = currentRoom.messages[0]
      getHistory(oldestId, currentRoomId)
    }, 300)
  }, [
    currentRoom.messages,
    currentRoomId,
    getHistory,
    isIntersecting,
    existHistoryFlg
  ])

  return (
    <Wrap ref={wrapRef} className={className}>
      <div ref={intersectionRef} style={{ visibility: 'hidden' }} />
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
