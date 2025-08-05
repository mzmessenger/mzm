import type { API } from 'mzm-shared/src/api/universal'
import { useEffect, useContext } from 'react'
import { atom, useAtom } from 'jotai'
import { clients, fetcher } from '../../lib/client'
import { DuckDBContext } from '../duckdb/index'
import { initRoomData, search as duckdbSearch } from './duckdb'

type SearchState = {
  showModal: boolean
  query: string
  initialized: boolean
  rooms: API['/api/rooms']['GET']['response']['200']['body']['rooms']
  total: number
  results: API['/api/rooms']['GET']['response'][200]['body']['rooms']
}

const searchState = atom<SearchState>({
  showModal: false,
  query: '',
  initialized: false,
  rooms: [],
  total: 0,
  results: []
})

let initialized = false

export const useSearch = () => {
  const [search, setSearch] = useAtom(searchState)
  const { db, tokenizer } = useContext(DuckDBContext)

  useEffect(() => {
    if (!db || initialized) return
    initialized = true
    setSearch((current) => ({
      ...current,
      initialized: true
    }))
    const rooms: API['/api/rooms']['GET']['response']['200']['body']['rooms'] =
      []
    const getRooms = async (threshold: string | null) => {
      const res = await clients['/api/rooms']['GET'].client({
        fetcher,
        query: {
          threshold
        }
      })
      rooms.push(...res.body.rooms)
      if (rooms.length < res.body.total && res.body.rooms.length > 0) {
        await getRooms(res.body.rooms[res.body.rooms.length - 1].id)
      }
    }
    getRooms(null).then(() => {
      setSearch((current) => ({
        ...current,
        rooms,
        total: rooms.length
      }))
      if (db && rooms.length > 0) {
        initRoomData(db, tokenizer, rooms)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db])

  const cancel = () => {
    setSearch((current) => ({
      ...current,
      showModal: false,
      query: '',
      results: []
    }))
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

    const { results } = await duckdbSearch(db, q)

    setSearch((current) => ({
      ...current,
      results
    }))

    return results
  }

  const execSearchNext = async () => {
    if (!search.query) {
      return
    }

    const { results } = await duckdbSearch(db, search.query, search.rooms.length)

    setSearch((current) => ({
      ...current,
      results
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
