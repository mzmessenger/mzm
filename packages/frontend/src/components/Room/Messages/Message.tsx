import React, { useEffect, useState, useRef, useMemo } from 'react'
import styled from '@emotion/styled'
import {
  Create as CreateIcon,
  ThumbUp as ThumbUpIcon
} from '@mui/icons-material'
import { sanitize } from '../../../lib/sanitize'
import { MessageBody } from '../../atoms/MessageBody'
import { MessageVote } from './MessageVote'
import { useMessage } from './Message.hooks'

type Props = {
  id: string
}

export const MessageElement: React.FC<Props> = (props) => {
  const {
    message,
    iine,
    html,
    icon,
    vote,
    updated,
    date,
    account,
    replied,
    myAccount,
    iineHandler,
    startEditHandler
  } = useMessage(props.id)

  const firstIineRef = useRef<number>()
  useEffect(() => {
    firstIineRef.current = iine ?? undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [iineAction, setIineAction] = useState(false)

  useEffect(() => {
    let timer = null
    if (firstIineRef !== undefined && firstIineRef.current !== iine) {
      setIineAction(true)
      timer = setTimeout(() => {
        setIineAction(false)
      }, 1000)
    }

    return () => {
      timer && clearTimeout(timer)
      setIineAction(false)
    }
  }, [iine])

  const className = useMemo(() => {
    const classNames = []
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
  }, [replied, iine, iineAction])

  if (!message) {
    return <></>
  }

  return (
    <MessageWrap className={className}>
      <img className="user-icon" src={icon} />
      <div className="header">
        <div className="account">{account}</div>
        <div className="iine icon" onClick={iineHandler}>
          <ThumbUpIcon className="thumbup" />
          {iine !== 0 && <div className="num">{iine}</div>}
        </div>
        <div className="actions">
          <div className="icon">
            {myAccount === account && <CreateIcon onClick={startEditHandler} />}
          </div>
        </div>
        <time>{date}</time>
      </div>
      <MessageBody className="body" message={message} html={sanitize(html)} />
      {vote && (
        <MessageVote messageId={props.id} className="vote" vote={vote} />
      )}
      <div className="footer">
        {updated && <div className="updated">(編集済み)</div>}
      </div>
    </MessageWrap>
  )
}

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

  .header {
    grid-area: message-header;
    min-height: 1.5em;
    display: flex;
    align-items: flex-end;
    .account: {
      height: 100%;
    }
    .iine {
      height: 100%;
      display: flex;
      align-items: center;
      margin: 0 0 0 1em;
      .num {
        margin-left: 0.3em;
        color: #2789ff;
        font-size: 0.9rem;
      }
    }
    .actions {
      visibility: hidden;
      flex: 1;
      display: flex;
      justify-content: flex-end;
    }
    .icon {
      cursor: pointer;
      svg {
        font-size: 1rem;
        opacity: 0.7;
      }
    }
    time {
      margin-left: 16px;
      letter-spacing: 0;
    }
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
