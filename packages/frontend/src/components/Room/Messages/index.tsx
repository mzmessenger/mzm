import React, { useRef, useEffect, useMemo } from 'react'
import styled from '@emotion/styled'
import { useSocketActions } from '../../../recoil/socket/hooks'
import {
  useRooms,
  useCurrentRoom,
  useRoomById
} from '../../../recoil/rooms/hooks'
import { useIntersectionObserver } from '../../../lib/hooks/useIntersectionObserver'
import { MessageElement } from './Message'

type Props = {
  className: string
}

export const Messages: React.FC<Props> = ({ className }) => {
  const { currentRoomId } = useCurrentRoom()
  const { scrollTargetIndex } = useRooms()
  const currentRoom = useRoomById(currentRoomId)
  const wrapRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef(0)
  const { getHistory } = useSocketActions()

  const [intersectionRef, isIntersecting] = useIntersectionObserver()

  const messages = useMemo(() => {
    return currentRoom?.messages || []
  }, [currentRoom?.messages])

  const existHistoryFlg = useMemo(() => {
    return messages.length > 0 && currentRoom?.existHistory
  }, [currentRoom?.existHistory, messages.length])

  useEffect(() => {
    if (!scrollTargetIndex) {
      return
    }
    if (scrollTargetIndex === 'bottom') {
      bottomRef.current?.scrollIntoView()
    } else if (typeof scrollTargetIndex === 'number') {
      const target = existHistoryFlg ? scrollTargetIndex + 1 : scrollTargetIndex
      const dom = wrapRef.current.querySelector(`.message:nth-child(${target})`)
      if (dom) {
        dom.scrollIntoView()
      }
    }
  }, [existHistoryFlg, messages.length, scrollTargetIndex])

  useEffect(() => {
    if (!isIntersecting || !existHistoryFlg || messages.length <= 0) {
      return
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => {
      const oldestId = messages[0]
      getHistory(oldestId, currentRoomId)
    }, 300)
  }, [messages, currentRoomId, getHistory, isIntersecting, existHistoryFlg])

  return (
    <Wrap className={className}>
      {messages.length > 0 && (
        <div ref={intersectionRef} style={{ visibility: 'hidden' }} />
      )}
      <div ref={wrapRef}>
        {messages.map((m) => (
          <MessageElement className="message" id={m} key={m} />
        ))}
      </div>
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
