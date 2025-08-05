import React from 'react'
import styled from '@emotion/styled'
import { useSearch } from '../../state/search/hooks'
import { TransparentButton } from '../atoms/Button'
import { SearchRoomElement } from './SearchRoomElement'

export const SearchResult = () => {
  const {
    search: { query, results, total },
    execSearchNext
  } = useSearch()

  const onClick = () => execSearchNext()

  return (
    <Wrap>
      <h4>部屋</h4>
      <ul>
        {results.map((e) => (
          <li key={e.id}>
            <SearchRoomElement
              name={e.name}
              iconUrl={e.iconUrl}
              description={e.description}
            />
          </li>
        ))}
      </ul>
      <div className="buttons">
        {query !== '' && total > results.length && (
          <TransparentButton onClick={onClick}>さらに表示</TransparentButton>
        )}
      </div>
    </Wrap>
  )
}

const Wrap = styled.div`
  > h4 {
    padding: 1em 1em 0 1em;
  }
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
