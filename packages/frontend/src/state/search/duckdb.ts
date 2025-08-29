import type { API } from 'mzm-shared/src/api/universal'
import { type Context } from '../duckdb/index'
import { tokenize } from '../../lib/duckdb.js'

type APIResponse = API['/api/rooms']['GET']['response']['200']['body']

const TABLE_NAME = 'rooms'

type Table = Pick<APIResponse['rooms'][number], 'id' | 'name' | 'status'> & {
  description: string
  iconUrl: string
  tokens: string
}

export async function initRoomData(
  db: Context['db'],
  tokenizer: Context['tokenizer'],
  data: APIResponse['rooms']
) {
  if (!db) {
    return
  }
  const conn = await db.connect()

  await conn.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id VARCHAR PRIMARY KEY,
      name VARCHAR,
      description VARCHAR,
      iconUrl VARCHAR,
      status INTEGER,
      tokens VARCHAR
    )`
  )

  const transformed = data.map((room) => {
    const name = room.name
    const description = room.description ?? ''

    const tokens = tokenize(tokenizer, `${name} ${description}`)

    return {
      id: room.id,
      name,
      description,
      iconUrl: room.iconUrl ?? '',
      status: room.status,
      tokens: tokens.join(' ')
    } satisfies Table
  })

  const filename = 'rooms.json'
  await db.registerFileText(filename, JSON.stringify(transformed))

  await conn.query(`
    INSERT INTO ${TABLE_NAME}
    SELECT * FROM read_json_auto('${filename}')
    ON CONFLICT DO UPDATE SET id = EXCLUDED.id
  `)

  // https://duckdb.org/docs/stable/core_extensions/full_text_search.html
  await conn.query(
    `PRAGMA create_fts_index(
      ${TABLE_NAME},
      id,
      tokens,
      stemmer = 'none',
      stopwords = 'none',
      ignore = '',
      strip_accents = 0,
      lower = 0
    )`
  )
}

export async function search(
  db: Context['db'],
  query: string,
  limit = 10
) {
  const queries = querySplitter(query)
  const conn = await db.connect()
  const sql = `SELECT id, name, description, iconUrl, status, score
FROM (
    SELECT *, fts_main_${TABLE_NAME}.match_bm25(
        id,
        '${queries.join(' ')}',
        fields := 'tokens'
    ) AS score
    FROM ${TABLE_NAME}
) sq
WHERE score IS NOT NULL AND score > 0.02
ORDER BY score DESC
LIMIT ${limit}`
  const rows = await conn.query(sql)

  const results: APIResponse['rooms'] = []

  for (const row of rows) {
    const room = JSON.parse(JSON.stringify(row))
    results.push({
      id: room.id,
      name: room.name,
      description: room.description,
      iconUrl: room.iconUrl,
      status: room.status
    } satisfies APIResponse['rooms'][number])
  }
  return { results }
}

function querySplitter(query: string): string[] {
  const queries = query.split(/\s+/)
  const querySet = queries.reduce((set, q) => {
    const text = (q || '').trim()
    if (text) {
      set.add(text)
    }
    return set
  }, new Set<string>())
  return Array.from(querySet)
}