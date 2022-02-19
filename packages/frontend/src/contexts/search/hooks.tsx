import { useState, useContext, useMemo, useCallback } from 'react'
import type { RESPONSE, REQUEST } from 'mzm-shared/type/api'
import { SearchContext, SearchDispatchContext } from './index'

export const useSearch = () => {
  return useContext(SearchContext)
}

export const useDispatchSearch = () => {
  return useContext(SearchDispatchContext)
}

export const useSearchForContext = () => {
  const [showModal, setShowModal] = useState(false)
  const [query, setQuery] = useState('')
  const [scroll, setScroll] = useState<string>(null)
  const [total, setTotal] = useState(0)
  const [results, setResults] = useState<
    { id: string; name: string; iconUrl: string }[]
  >([])

  const state = useMemo(() => {
    return {
      showModal,
      query,
      results,
      total
    }
  }, [query, showModal, results, total])

  const cancel = () => {
    setQuery('')
    setShowModal(false)
    setScroll(null)
    setResults([])
    setTotal(0)
  }

  const open = () => {
    setShowModal(true)
  }

  const search = async (q: string) => {
    setQuery(q)
    const init: [keyof REQUEST['/api/rooms/search']['GET']['query'], string][] =
      [['query', q]]
    const params = new URLSearchParams(init)

    const res = await fetch(`/api/rooms/search?${params.toString()}`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })

    if (!res.ok) {
      return res
    }

    const { hits, scroll, total } =
      (await res.json()) as RESPONSE['/api/rooms/search']['GET']

    setResults(hits)
    setScroll(scroll)
    setTotal(total)

    return res
  }

  const searchNext = async () => {
    if (!query || !scroll) {
      return
    }

    const init: [keyof REQUEST['/api/rooms/search']['GET']['query'], string][] =
      [
        ['query', query],
        ['scroll', scroll]
      ]

    const params = new URLSearchParams(init)

    const res = await fetch(`/api/rooms/search?${params.toString()}`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })

    if (res.ok) {
      const { hits, scroll, total } =
        (await res.json()) as RESPONSE['/api/rooms/search']['GET']

      setResults([...results, ...hits])
      setScroll(scroll)
      setTotal(total)
    }

    return res
  }

  return {
    state,
    open: useCallback(open, []),
    cancel: useCallback(cancel, []),
    search: useCallback(search, []),
    searchNext: useCallback(searchNext, [query, results, scroll])
  } as const
}
