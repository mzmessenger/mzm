import React from 'react'
import styled from 'styled-components'
import { useNavigate } from 'react-router-dom'
import TransparentButton from './atoms/TransparentButton'
import Home from '@material-ui/icons/Home'
import { useSearch, useDispatchSearch } from '../contexts/search/hooks'
import { useDispatchRooms } from '../contexts/rooms/hooks'
import { useDispatchSocket } from '../contexts/socket/hooks'
import { useDispatchUi } from '../contexts/ui/hooks'

const SearchRoomElem = ({
  name,
  iconUrl
}: {
  name: string
  iconUrl: string
}) => {
  const navigate = useNavigate()
  const { enterRoom } = useDispatchRooms()
  const { getMessages, enterRoom: enterRoomSocket } = useDispatchSocket()
  const { cancel } = useDispatchSearch()
  const { closeMenu } = useDispatchUi()
  const onClick = () => {
    enterRoom(name, getMessages, enterRoomSocket, closeMenu).then(() => {
      navigate(`/rooms/${name}`)
      cancel()
    })
  }

  return (
    <RoomWrap className="search-room-elem">
      <div className="room-info">
        <div className="room-icon">
          {iconUrl ? <img src={iconUrl} /> : <Home />}
        </div>
        <div className="room-name">{name}</div>
      </div>
      <div className="buttons">
        <button onClick={onClick}>入室する</button>
      </div>
    </RoomWrap>
  )
}

const RoomWrap = styled.div`
  padding: 4px 8px 0;
  &:last-child {
    padding-bottom: 4px;
  }

  color: var(--color-on-surface);

  .room-info {
    display: flex;
    align-items: center;
  }

  .room-icon {
    width: 32px;
    height: 32px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0 8px 0 0;
    img {
      max-height: 100%;
      max-width: 100%;
    }
  }

  .room-name {
    flex: 1;
  }

  .buttons {
    display: flex;
    justify-content: center;
  }
`

const SearchResult = () => {
  const { results, total } = useSearch()
  const { searchNext } = useDispatchSearch()

  const onClick = () => searchNext()

  return (
    <Wrap>
      <ul>
        {results.map((e) => (
          <li key={e.id}>
            <SearchRoomElem name={e.name} iconUrl={e.iconUrl} />
          </li>
        ))}
      </ul>
      <div className="buttons">
        {total > results.length && (
          <TransparentButton onClick={onClick}>さらに表示</TransparentButton>
        )}
      </div>
    </Wrap>
  )
}
export default SearchResult

const Wrap = styled.div`
  border-bottom: 1px solid var(--color-border);

  > ul {
    list-style-type: none;
    padding: 0;
    margin: 0;
    > li {
      border-bottom: 1px solid var(--color-border);
      padding: 3px 0;
    }
  }

  > .buttons {
    display: flex;
    button {
      flex: 1;
      height: 32px;
    }
  }
`
