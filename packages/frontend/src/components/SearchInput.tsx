import React from 'react'
import styled from '@emotion/styled'
import { useSearch, useDispatchSearch } from '../contexts/search/hooks'
import InputText from './atoms/InputText'
import Button from './atoms/TransparentButton'

const SearchInput = () => {
  const { query } = useSearch()
  const { search, cancel } = useDispatchSearch()

  const onChange = (e) => search(e.target.value)

  const onCancel = () => cancel()

  return (
    <Wrap>
      <InputText style={{ flex: 1 }} value={query} onChange={onChange} />
      {query && (
        <Button className="button-cancel" onClick={onCancel}>
          キャンセル
        </Button>
      )}
    </Wrap>
  )
}
export default SearchInput

const Wrap = styled.div`
  display: flex;
  padding: 4px 12px 4px 4px;
  border-bottom: 1px solid var(--color-border);

  .button-cancel {
    border: 1px solid var(--color-on-primary);
    background-color: transparent;
    width: 100px;
    margin: 0 0 0 4px;
  }
`
