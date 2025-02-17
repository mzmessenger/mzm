import React, { useEffect, useState, useRef, useMemo } from 'react'
import styled from '@emotion/styled'
import { sanitize } from '../../../lib/sanitize'
import { MessageBody } from '../../atoms/MessageBody'
import { MessageVote } from './MessageVote'
import { useMessage } from './Message.hooks'
import { MessageHeader } from './MessageHeader'

type Props = {
  id: string
  className: string
}

const MessageElementInner: React.FC<Props> = (props) => {
  const {
    message,
    iine,
    html,
    icon,
    vote,
    updated,
    removed,
    date,
    account,
    userId,
    replied,
    iineHandler,
    deleteHandler,
    startEditHandler
  } = useMessage(props.id)

  const firstIineRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    firstIineRef.current = iine ?? undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [iineAction, setIineAction] = useState(false)

  useEffect(() => {
    let timer: number | null = null
    if (firstIineRef !== undefined && firstIineRef.current !== iine) {
      setIineAction(true)
      timer = window.setTimeout(() => {
        setIineAction(false)
      }, 1000)
    }

    return () => {
      if (timer) clearTimeout(timer)
      setIineAction(false)
    }
  }, [iine])

  const className = useMemo(() => {
    const classNames = [props.className]
    if (replied) {
      classNames.push('replied')
    }
    if (iine >= 20) {
      classNames.push('iine-max')
    }
    if (iineAction) {
      classNames.push('kururi')
    }

    return classNames.join(' ')
  }, [props.className, replied, iine, iineAction])

  return (
    <MessageWrap className={className}>
      <img className="user-icon" src={icon} crossOrigin="anonymous" />
      <MessageHeader
        id={userId}
        account={account}
        icon={icon}
        iine={iine}
        date={date}
        removed={removed}
        iineHandler={iineHandler}
        deleteHandler={deleteHandler}
        startEditHandler={startEditHandler}
      />
      <MessageBody
        className="body"
        removed={removed}
        message={message}
        // todo: worker
        html={sanitize(html)}
      />
      {vote && (
        <MessageVote messageId={props.id} className="vote" vote={vote} />
      )}
      <div className="footer">
        {updated && <div className="updated">(編集済み)</div>}
      </div>
    </MessageWrap>
  )
}

export const MessageElement = React.memo(MessageElementInner)

const MessageWrap = styled.div`
  --icon-size: 32px;

  padding: 0.5em 1em 0.5em;
  border-radius: 1px;
  color: #dcddde;
  display: grid;
  grid-template-columns: calc(var(--icon-size) + 1em);
  grid-template-areas:
    'icon message-header'
    'icon message-body'
    'icon message-vote'
    'icon message-footer';

  &.iine-max {
    color: hsl(0, 0%, 0%);
    background: #fdd;
  }

  &.replied {
    color: var(--color-on-replied);
    background: var(--color-replied);
  }

  .user-icon {
    margin: 0.4em 0 0 0;
  }

  .body {
    grid-area: message-body;
  }

  .vote {
    grid-area: message-vote;
  }

  .user-icon {
    grid-area: icon;
    width: var(--icon-size);
    height: var(--icon-size);
    border-radius: 2px;
  }

  .footer {
    grid-area: message-footer;
    .updated {
      margin-top: 4px;
      font-size: 8px;
      color: hsla(0, 100%, 100%, 0.5);
    }
  }

  &:hover {
    .actions {
      visibility: visible;
    }
  }
  &.kururi {
    animation: kururi 0.75s 0s 1;
  }
  @keyframes kururi {
    0% {
      transform: scale(0.8) rotateY(90deg);
    }
    40% {
      transform: scale(0.8) rotateY(0deg);
    }
    100% {
      transform: scale(1);
    }
  }
`
