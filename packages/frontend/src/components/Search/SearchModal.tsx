import React from 'react'
import styled from '@emotion/styled'
import { Search, Close } from '@mui/icons-material'
import { useSearch, useDispatchSearch } from '../../contexts/search/hooks'
import { ModalBase } from '../atoms/Modal'
import { IconButton } from '../atoms/Button'
import { SearchResult } from './SearchResults'

export const SearchModal: React.FC = () => {
  const { showModal, query } = useSearch()
  const { search, cancel } = useDispatchSearch()

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    search(e.target.value)
  }

  return (
    <ModalBase open={showModal} onClose={() => cancel()} style={{ top: 200 }}>
      <ModalInner>
        <div className="query">
          <Search />
          <input
            type="text"
            value={query}
            onChange={onChange}
            placeholder="search"
          />
          <IconButton onClick={() => cancel()}>
            <Close />
          </IconButton>
        </div>
        <div className="result scroll-styled-y">
          <SearchResult />
        </div>
      </ModalInner>
    </ModalBase>
  )
}

const ModalInner = styled.div`
  max-width: 800px;
  min-width: 700px;
  max-height: 90vh;
  border-radius: 3px;
  background-color: var(--color-background);
  color: var(--color-on-background);

  .query {
    display: flex;
    align-items: center;
    padding: 1em;
    border-bottom: 1px solid var(--color-border);

    input {
      margin-left: 0.5em;
      flex: 1;
      background: none;
      color: var(--color-input);
      resize: none;
      border: none;
      appearance: none;
      font-size: 1.2em;
    }
  }

  .result {
    min-height: 300px;
    overflow-y: scroll;
  }
`
