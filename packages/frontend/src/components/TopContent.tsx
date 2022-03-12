import React, { useMemo } from 'react'
import styled from '@emotion/styled'
import { useLinkClick } from '../lib/hooks/useLinkClick'

const recommended = ['要望室', 'test']

const LinkElem = (props: { name: string }) => {
  const [ref] = useLinkClick()
  const url = useMemo(() => {
    return `${window.location.protocol}//${window.location.host}/rooms/${props.name}`
  }, [props.name])

  return (
    <div className="room" ref={ref}>
      <a href={url}>{props.name}</a>
    </div>
  )
}

export const TopContent = () => {
  return (
    <Wrap>
      <div className="content">
        <div className="recommended">
          <div className="inner">
            <h2>おすすめ部屋</h2>
            <div className="rooms">
              {recommended.map((e) => (
                <LinkElem key={e} name={e} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Wrap>
  )
}

const Wrap = styled.div`
  width: 100%;
  flex: 1;
  border-right: 1px solid var(--color-border);
  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .recommended {
    min-width: 400px;
    display: flex;
    padding: 24px;
    .inner {
      width: 100%;
      padding: 8px 24px 24px 24px;
      background-color: var(--color-surface);
      color: var(--color-on-surface);
      .rooms {
        margin-top: 8px;
      }
      .room {
        display: flex;
        align-items: center;
        margin-top: 8px;
        &:first-of-type {
          margin-top: 0;
        }
        a {
          font-size: 20px;
          border: solid 1px var(--color-link);
          border-radius: 2px;
          padding: 4px 8px;
        }
      }
    }
  }
`
