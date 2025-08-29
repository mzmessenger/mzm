import { createContext } from 'react'
import { type initDuckDB } from '../../lib/duckdb.js'

type InitDuckDB = Awaited<ReturnType<typeof initDuckDB>>

export type Context =
  | {
      db: InitDuckDB['db']
      tokenizer: InitDuckDB['tokenizer']
    }
  | {
      db: null
      tokenizer: null
    }

export const initValue: Context = {
  db: null,
  tokenizer: null
} as const

export const DuckDBContext = createContext<Context>(initValue)
