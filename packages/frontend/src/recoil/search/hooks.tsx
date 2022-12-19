import type { RESPONSE, REQUEST } from 'mzm-shared/type/api'
import { atom, useRecoilState } from 'recoil'

type SearchState = {
  showModal: boolean
  query: string
  scroll: string
  total: number
  results: RESPONSE['/api/rooms/search']['GET']['hits']
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

    setSearch((current) => ({
      ...current,
      scroll,
      total,
      results: hits
    }))

    return res
  }

  const execSearchNext = async () => {
    if (!search.query || !scroll) {
      return
    }

    const init: [keyof REQUEST['/api/rooms/search']['GET']['query'], string][] =
      [
        ['query', search.query],
        ['scroll', search.scroll]
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

      setSearch((current) => ({
        ...current,
        results: [...current.results, ...hits],
        scroll,
        total
      }))
    }

    return res
  }

  return {
    search,
    open,
    cancel,
    execSearch,
    execSearchNext
  } as const
}
