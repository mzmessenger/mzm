import { useEffect, useState, type PropsWithChildren } from 'react'
import { DuckDBContext, initValue, type Context } from './index'
import { initDuckDB } from '../../lib/duckdb.js'

let init = false

export default function DuckDBProvider({ children }: PropsWithChildren) {
  const [value, setValue] = useState<Context>(initValue)
  useEffect(() => {
    if (init) {
      return
    }
    init = true
    initDuckDB().then(({ db, tokenizer }) => {
      setValue({
        db,
        tokenizer
      })
    })
  }, [])

  return <DuckDBContext value={value}>{children}</DuckDBContext>
}
