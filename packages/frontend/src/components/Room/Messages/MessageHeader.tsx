import React, { useMemo } from 'react'
import styled from '@emotion/styled'
import {
  Create as CreateIcon,
  ThumbUp as ThumbUpIcon,
  Delete as DeleteIcon
} from '@mui/icons-material'
import { IconButton } from '../../atoms/Button'
import { useUiActions } from '../../../recoil/ui/hooks'
import { useUserAccount } from '../../../recoil/user/hooks'

type Props = {
  id: string
  account: string
  icon: string
  iine?: number
  date: string
  removed: boolean
  iineHandler: () => void
  deleteHandler: () => void
  startEditHandler: React.MouseEventHandler
}

const Actions: React.FC<{
  account: Props['account']
  iine: Props['iine']
  iineHandler: Props['iineHandler']
  deleteHandler: Props['deleteHandler']
  startEditHandler: Props['startEditHandler']
}> = (props) => {
  const { userAccount } = useUserAccount()

  return (
    <>
      <IconButton className="iine icon" onClick={props.iineHandler}>
        <ThumbUpIcon className="thumbup" />
        {props.iine !== 0 && <div className="num">{props.iine}</div>}
      </IconButton>
      <div className="actions">
        <div className="icon">
          {userAccount === props.account && (
            <>
              <IconButton className="icon" onClick={props.deleteHandler}>
                <DeleteIcon className="thumbup" />
              </IconButton>
              <IconButton className="modify icon">
                <CreateIcon onClick={props.startEditHandler} />
              </IconButton>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export const MessageHeader: React.FC<Props> = (props) => {
  const { openUserDetail } = useUiActions()

  const clickAccount = () => {
    openUserDetail(props.id, props.account, props.icon)
  }

  return (
    <Wrap>
      <span className="account" onClick={clickAccount}>
        {props.account}
      </span>
      {props.removed && <div className="space"></div>}
      {!props.removed && (
        <Actions
          account={props.account}
          iine={props.iine}
          iineHandler={props.iineHandler}
          deleteHandler={props.deleteHandler}
          startEditHandler={props.startEditHandler}
        />
      )}
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

  .space {
    flex: 1;
  }

  .actions {
    visibility: hidden;
    flex: 1;
    display: flex;
    justify-content: flex-end;
  }

  .modify {
    margin: 0 0 0 0.5em;
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
