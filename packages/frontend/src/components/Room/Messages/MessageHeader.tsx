import React, { useMemo } from 'react'
import styled from '@emotion/styled'
import {
  Create as CreateIcon,
  ThumbUp as ThumbUpIcon
} from '@mui/icons-material'
import { IconButton } from '../../atoms/Button'
import { useDispatchUi } from '../../../contexts/ui/hooks'
import { useUser } from '../../../contexts/user/hooks'

type Props = {
  id: string
  account: string
  icon: string
  iine?: number
  date: string
  iineHandler: () => void
  startEditHandler: React.MouseEventHandler
}

export const MessageHeader: React.FC<Props> = (props) => {
  const { me } = useUser()
  const { openUserDetail } = useDispatchUi()
  const myAccount = useMemo(() => {
    return me?.account ?? ''
  }, [me])

  const clickAccount = () => {
    openUserDetail(props.id, props.account, props.icon)
  }

  return (
    <Wrap>
      <span className="account" onClick={clickAccount}>
        {props.account}
      </span>
      <IconButton className="iine icon" onClick={props.iineHandler}>
        <ThumbUpIcon className="thumbup" />
        {props.iine !== 0 && <div className="num">{props.iine}</div>}
      </IconButton>
      <div className="actions">
        <div className="icon">
          {myAccount === props.account && (
            <IconButton className="icon">
              <CreateIcon onClick={props.startEditHandler} />
            </IconButton>
          )}
        </div>
      </div>
      <time>{props.date}</time>
    </Wrap>
  )
}

const Wrap = styled.div`
  grid-area: message-header;
  min-height: 1.5em;
  display: flex;
  align-items: center;

  .account {
    display: flex;
    align-items: center;
    height: 100%;
    cursor: pointer;
    &:hover {
      text-decoration: underline;
    }
  }

  .iine {
    display: flex;
    align-items: center;
    margin: 0 0 0 0.5em;
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
    svg {
      font-size: 1rem;
      opacity: 0.7;
    }
  }

  time {
    margin-left: 16px;
    letter-spacing: 0;
  }
`
