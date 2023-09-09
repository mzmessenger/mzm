import type { API } from 'mzm-shared/src/api/universal'
import { clients, fetcher } from '../../lib/client'
import { atom, useRecoilState } from 'recoil'

type SearchState = {
  showModal: boolean
  query: string
  scroll: string
  total: number
  results: API['/api/rooms/search']['GET']['response'][200]['body']['hits']
}

const searchState = atom<SearchState>({
  key: 'state:search',
  default: {
    showModal: false,
    query: '',
    scroll: null,
    total: 0,
    results: []
  }
})

export const useSearch = () => {
  const [search, setSearch] = useRecoilState(searchState)

  const cancel = () => {
    setSearch({
      showModal: false,
      query: '',
      scroll: null,
      total: 0,
      results: []
    })
  }

  const open = () => {
    setSearch((current) => ({
      ...current,
      showModal: true
    }))
  }

  const execSearch = async (q: string) => {
    setSearch((current) => ({
      ...current,
      query: q
    }))

    const res = await clients['/api/rooms/search']['GET'].client({
      fetcher,
      query: {
        query: q
      }
    })

    if (!res.ok) {
      return res
    }

    const { hits, scroll, total } = res.body

    setSearch((current) => ({
      ...current,
      scroll,
      total,
      results: hits
    }))

    return res
  }

  const execSearchNext = async () => {
    if (!search.query || !search.scroll) {
      return
    }

    const res = await clients['/api/rooms/search']['GET'].client({
      fetcher,
      query: {
        query: search.query,
        scroll: search.scroll
      }
    })

    if (!res.ok) {
      return res
    }

    const { hits, scroll, total } = res.body

    setSearch((current) => ({
      ...current,
      results: [...current.results, ...hits],
      scroll,
      total
    }))
  }

  return {
    search,
    open,
    cancel,
    execSearch,
    execSearchNext
  } as const
}
