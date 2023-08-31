import type { API } from 'mzm-shared/src/type/api'
import { atom, useRecoilState } from 'recoil'

type SearchAPI = API['/api/rooms/search']['GET']

type SearchState = {
  showModal: boolean
  query: string
  scroll: string
  total: number
  results: SearchAPI['response'][200]['body']['hits']
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
    const init: [keyof SearchAPI['request']['query'], string][] = [['query', q]]
    const params = new URLSearchParams(init)

    // @todo
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
      (await res.json()) as SearchAPI['response'][200]['body']

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

    const init: [keyof SearchAPI['request']['query'], string][] = [
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
        (await res.json()) as SearchAPI['response'][200]['body']

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
