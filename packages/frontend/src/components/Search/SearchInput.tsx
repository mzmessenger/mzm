import React from 'react'
import styled from '@emotion/styled'
import SearchIcon from '@mui/icons-material/Search'
import { useSearch } from '../../state/search/hooks'
import { SearchModal } from './SearchModal'

export const SearchInput = () => {
  const { open } = useSearch()

  return (
    <Wrap>
      <div className="search-input">
        <button onClick={() => open()}>
          <span>search</span>
          <SearchIcon />
        </button>
      </div>
      <SearchModal />
    </Wrap>
  )
}

const Wrap = styled.div`
  display: flex;
  align-items: center;
  padding: 0 0.5em 0 0;
  border-bottom: 1px solid var(--color-border);
  min-height: var(--navi-height);

  .search-input {
    min-width: 100%;
    button {
      display: flex;
      align-items: center;
      min-width: 100%;
      border-radius: 15px;
      border: none;
      background-color: var(--color-input-background);
      color: var(--color-input);
      > span {
        flex: 1;
      }
    }
  }
`
