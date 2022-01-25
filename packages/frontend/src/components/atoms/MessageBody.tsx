import React, { useRef, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useHistory } from 'react-router-dom'
import styled from 'styled-components'
import { store } from '../../modules/index'
import { enterRoom } from '../../modules/rooms'
import { getRoomName } from '../../lib/util'

type Props = {
  className?: string
  message: string
  html: string
}

const MessageBody = ({ className, message, html }: Props) => {
  const dispatch = useDispatch()
  const history = useHistory()
  const messageEl = useRef(null)

  useEffect(() => {
    if (!messageEl.current) {
      return
    }
    const listener = (e) => {
      const href = e.target.getAttribute('href')
      const url = new URL(href)
      if (url.host === location.host) {
        history.push(url.pathname)
        const roomName = getRoomName(decodeURIComponent(url.pathname))
        enterRoom(roomName)(dispatch, store.getState)
      } else {
        window.open(url.href, '_blank')
      }

      e.preventDefault()
      e.stopPropagation()
    }
    messageEl.current
      .querySelectorAll('a')
      .forEach((e) => e.addEventListener('click', listener))
    return () => {
      messageEl.current
        .querySelectorAll('a')
        .forEach((e) => e.removeEventListener('click', listener))
    }
  }, [messageEl])

  return (
    <Wrap
      className={className}
      ref={messageEl}
      attr-message={message}
      dangerouslySetInnerHTML={{ __html: html }}
    ></Wrap>
  )
}
export default MessageBody

const Wrap = styled.div`
  padding: 5px 0 0 0;
  word-break: break-all;
  p {
    font-size: 14px;
    line-height: 1.7;
    margin: 0;
    white-space: pre-wrap;
  }
  a {
    color: var(--color-link);
  }

  ul {
    list-style-type: none;
    margin: 0;
    padding: 0;
    > li {
      padding: 0;
    }
    > li:before {
      content: '-';
      margin: 0 0.5em 0 0;
    }
    .check {
      margin: 0 0.5em 0 0;
    }
  }

  .mzm-room-link {
    border: solid 1px var(--color-link);
    border-radius: 2px;
    padding: 2px 8px;
    margin: 0 2px 0 2px;
  }
`
