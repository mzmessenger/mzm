import React from 'react'
import styled from '@emotion/styled'
import { useLinkClick } from '../../lib/hooks/useLinkClick'

type Props = {
  className?: string
  removed: boolean
  message: string
  html: string
}

const RemovedMessageBody: React.FC = () => {
  return <WrapRemoved>This message has been deleted!</WrapRemoved>
}

const WrapRemoved = styled.div`
  margin: 0.7em 0 0.7em 0;
  padding: 0.7em;
  word-break: break-all;
  background: var(--color-background-secondary);
`

export const MessageBody: React.FC<Props> = (props) => {
  const [messageRef] = useLinkClick()

  if (props.removed) {
    return <RemovedMessageBody />
  }

  return (
    <Wrap
      className={props.className}
      ref={messageRef}
      attr-message={props.message}
      dangerouslySetInnerHTML={{ __html: props.html }}
    ></Wrap>
  )
}

const Wrap = styled.div`
  margin: 0.7em 0 0 0;
  word-break: break-all;

  > p,
  > pre,
  > a,
  > ul {
    margin: 0 0 0.7em 0;
  }

  > p {
    font-size: 14px;
    line-height: 1.7;
    white-space: pre-wrap;
  }

  > a {
    color: var(--color-link);
  }

  > ul {
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
