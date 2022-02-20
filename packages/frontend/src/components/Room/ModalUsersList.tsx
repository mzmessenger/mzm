import React, { useRef, useState, useEffect } from 'react'
import styled from '@emotion/styled'
import CancelIcon from '@mui/icons-material/Cancel'
import { ModalProps, ModalBase } from '../atoms/Modal'
import { useRooms, useDispatchRooms } from '../../contexts/rooms/hooks'

type Props = ModalProps & { roomId: string }

const useIntersectionObserver = () => {
  const [node, setNode] = useState<Element>(null)
  const [isIntersecting, setIsIntersecting] = useState<boolean>(false)

  const observerRef = useRef(
    new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting)
      },
      {
        rootMargin: '10px',
        threshold: 1.0
      }
    )
  )

  useEffect(() => {
    if (node) {
      observerRef.current.observe(node)
    }
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      observerRef.current?.disconnect()
    }
  }, [node])

  return [setNode, isIntersecting] as const
}

export const ModalUsersList: React.FC<Props> = ({ open, onClose, roomId }) => {
  const {
    users: {
      byId: { [roomId]: users }
    }
  } = useRooms()
  const { getNextUsers } = useDispatchRooms()
  const [loading, setLoading] = useState(false)
  const listWrapRef = useRef<HTMLUListElement>(null)

  const [intersectionRef, isIntersecting] = useIntersectionObserver()

  useEffect(() => {
    if (isIntersecting) {
      if (loading) {
        return
      }
      setLoading(true)
      getNextUsers(roomId).then(() => setLoading(false))
    }
  }, [getNextUsers, isIntersecting, loading, roomId])

  const list = (users?.users || []).map((e) => (
    <li key={e.userId} attr-id={e.userId}>
      <img src={e.icon} className="icon" />
      {e.account}
    </li>
  ))

  return (
    <ModalBase open={open} onClose={onClose}>
      <ModalInner>
        <header>
          <h4>入室中ユーザー</h4>
          <CancelIcon className="cancel" onClick={onClose} />
        </header>
        <div className="count">{users?.count || 0}</div>
        <div className="users">
          <ul ref={listWrapRef} className="scroll-styled-y">
            {list}
            <li className="last" ref={intersectionRef}></li>
          </ul>
        </div>
      </ModalInner>
    </ModalBase>
  )
}

const ModalInner = styled.form`
  width: 440px;
  border-radius: 3px;
  background-color: var(--color-background);
  color: var(--color-on-background);
  padding: 20px;

  header {
    display: flex;
    h4 {
      margin: 0;
      flex: 1;
    }
    .cancel {
      cursor: pointer;
    }
  }

  .count {
    display: flex;
    justify-content: flex-end;
    padding: 0.5em 0.2em 0.5em 0;
    border-bottom: 1px solid var(--color-border);
  }

  .users {
    ul {
      list-style-type: none;
      margin: 0;
      padding: 0;
      max-height: 400px;
      overflow: auto;
      > li {
        padding: 1em 0 1em;
        display: flex;
        border-bottom: 1px solid var(--color-border);
      }
      > li.last {
        visibility: hidden;
      }
    }
    .icon {
      padding-left: 3px;
      width: 20px;
      height: 20px;
      margin: 0 1em 0 0;
    }
  }
`
