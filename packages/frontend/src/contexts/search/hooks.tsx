import { useState, useContext, useMemo, useCallback } from 'react'
import { SearchContext, SearchDispatchContext } from './index'

export const useSearch = () => {
  return useContext(SearchContext)
}

export const useDispatchSearch = () => {
  return useContext(SearchDispatchContext)
}

export const userSearchForContext = () => {
  const [query, setQuery] = useState('')
  const [scroll, setScroll] = useState<string>(null)
  const [total, setTotal] = useState(0)
  const [results, setResults] = useState<
    { id: string; name: string; iconUrl: string }[]
  >([])

  const state = useMemo(() => {
    return {
      query,
      results,
      total
    }
  }, [query, results, total])

  const cancel = () => {
    setQuery('')
    setScroll(null)
    setResults([])
    setTotal(0)
  }

  const search = async (q: string) => {
    setQuery(q)
    const params = new URLSearchParams([['query', q]])

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

    const { hits, scroll, total } = await res.json()

    setResults(hits)
    setScroll(scroll)
    setTotal(total)

    return res
  }

  const searchNext = async () => {
    if (!query || !scroll) {
      return
    }
    const params = new URLSearchParams([
      ['query', query],
      ['scroll', scroll]
    ])

    const res = await fetch(`/api/rooms/search?${params.toString()}`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    })

    if (res.ok) {
      const { hits, scroll, total } = await res.json()

      setResults([...results, ...hits])
      setScroll(scroll)
      setTotal(total)
    }

    return res
  }

  return {
    state,
    cancel: useCallback(cancel, []),
    search: useCallback(search, []),
    searchNext: useCallback(searchNext, [])
  } as const
}
