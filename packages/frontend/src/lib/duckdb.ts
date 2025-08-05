import type { Tokenizer } from 'lindera-wasm-ipadic'

export async function initDuckDB() {
  const [duckdb, lindera] = await Promise.all([initDb(), initLindera()])

  return {
    db: duckdb.db,
    tokenizer: lindera.tokenizer
  }
}

async function initDb() {
  const duckdb = await import('@duckdb/duckdb-wasm')
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles()

  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES)

  const worker_url = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], {
      type: 'text/javascript'
    })
  )

  const worker = new Worker(worker_url)
  const logger =
    window.location.hostname === 'localhost'
      ? new duckdb.ConsoleLogger()
      : new duckdb.VoidLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)

  const conn = await db.connect()
  await conn.query('LOAD fts;')
  await conn.query('INSTALL fts;')
  conn.close()

  return {
    db
  }
}

// init tokenizer
// https://github.com/lindera/lindera-wasm
async function initLindera() {
  const lindera = await import('lindera-wasm-ipadic')
  await lindera.default()
  const { TokenizerBuilder } = lindera
  const builder = new TokenizerBuilder()
  builder.setDictionaryKind('ipadic')
  builder.setMode('normal')
  builder.appendCharacterFilter('unicode_normalize', { kind: 'nfkc' })
  builder.appendTokenFilter('lowercase', {})

  const tokenizer = builder.build()
  return {
    tokenizer
  }
}

type TokenDataMap = {
  'byte_end': number
  'byte_start': number
  'details': string[]
  'text': string
  'word_id': TypedMap<{ 'id': number, 'is_system': boolean }>
}

interface TypedMap<T extends Record<string, unknown>> extends Map<string, unknown> {
  get<K extends keyof T>(key: K): T[K] | undefined
}

type Token = Readonly<TypedMap<TokenDataMap>>

export function tokenize(tokenizer: Tokenizer, text: string): string[] {
  const tokens = tokenizer.tokenize(text) as Token[]
  const tokenSet = tokens.reduce((set, token) => {
    const text = (token.get('text') || '').trim()
    if (text) {
      set.add(text)
    }
    return set
  }, new Set<string>())
  return Array.from(tokenSet)
}
