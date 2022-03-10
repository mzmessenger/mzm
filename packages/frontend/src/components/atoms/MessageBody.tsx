import React from 'react'
import styled from '@emotion/styled'
import { useLinkClick } from '../../lib/hooks/useLinkClick'

type Props = {
  className?: string
  message: string
  html: string
}

export const MessageBody: React.FC<Props> = ({ className, message, html }) => {
  const [messageRef] = useLinkClick()

  return (
    <Wrap
      className={className}
      ref={messageRef}
      attr-message={message}
      dangerouslySetInnerHTML={{ __html: html }}
    ></Wrap>
  )
}

const Wrap = styled.div`
  padding: 5px 0 0 0;
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
