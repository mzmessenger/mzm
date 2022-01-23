import { ObjectId } from 'mongodb'
import { logger } from '../logger'
import { lock, release } from '../redis'
import * as config from '../../config'
import * as db from '../db'
import { client as es } from './index'

const settings = {
  index: { max_ngram_diff: 2 },
  analysis: {
    tokenizer: {
      kuromoji_tokenizer: {
        type: 'kuromoji_tokenizer',
        mode: 'search'
      },
      unigram_tokenizer: {
        type: 'ngram',
        min_gram: 1,
        max_gram: 3,
        token_chars: ['letter', 'digit', 'punctuation', 'symbol']
      }
    },
    char_filter: {
      normalize: {
        type: 'icu_normalizer',
        name: 'nfkc',
        mode: 'compose'
      }
    },
    filter: {
      unigram: {
        type: 'ngram',
        min_gram: 1,
        max_gram: 3
      },
      romaji_readingform: {
        type: 'kuromoji_readingform',
        use_romaji: true
      }
    },
    analyzer: {
      kuromoji_index: {
        type: 'custom',
        tokenizer: 'kuromoji_tokenizer',
        char_filter: ['normalize'],
        filter: [
          'lowercase',
          'trim',
          'romaji_readingform',
          'asciifolding',
          'unigram'
        ]
      },
      kuromoji_search: {
        type: 'custom',
        tokenizer: 'kuromoji_tokenizer',
        char_filter: ['normalize'],
        filter: ['lowercase', 'trim', 'romaji_readingform', 'asciifolding']
      },
      unigram_index: {
        type: 'custom',
        tokenizer: 'unigram_tokenizer',
        filter: ['lowercase']
      }
    }
  }
}

const mappings = {
  properties: {
    name: {
      properties: {
        ngram: {
          type: 'text',
          analyzer: 'unigram_index'
        },
        kuromoji: {
          type: 'text',
          search_analyzer: 'kuromoji_search',
          analyzer: 'kuromoji_index'
        }
      }
    },
    status: {
      type: 'integer'
    }
  }
}

export type RoomMappingsProperties = {
  name: {
    ngram: string
    kuromoji: string
  }
} & Pick<db.Room, 'status'>

export type RoomMappings = {
  _doc: {
    _source: {
      enabled: boolean
    }
    properties: RoomMappingsProperties
  }
}

const putIndex = async () => {
  await es.indices.close({ index: config.elasticsearch.index.room })

  await es.indices.putSettings({
    index: config.elasticsearch.index.room,
    body: settings
  })

  await es.indices.putMapping({
    index: config.elasticsearch.index.room,
    body: mappings
  })

  await es.indices.open({ index: config.elasticsearch.index.room })
}

export const initAlias = async () => {
  const lockKey = config.lock.INIT_SEARCH_ROOM
  const lockVal = new ObjectId().toHexString()
  const locked = await lock(lockKey, lockVal, 1000 * 5)

  if (!locked) {
    logger.info('[locked] initAlias')
    return
  }

  const res = await es.indices.exists({
    index: config.elasticsearch.index.room
  })

  if (res.body) {
    await putIndex()
  } else {
    await es.indices.create({
      index: config.elasticsearch.index.room,
      body: { settings, mappings }
    })
    await es.indices.open({ index: config.elasticsearch.index.room })
  }

  await es.indices.putAlias({
    index: config.elasticsearch.index.room,
    name: config.elasticsearch.alias.room
  })

  await release(lockKey, lockVal)
}

export const insertRooms = async (roomIds: string[]) => {
  const ids = roomIds.map((e) => new ObjectId(e))
  const cursor = await db.collections.rooms.find({ _id: { $in: ids } })

  type Body =
    | { index: { _index: string; _id: string } }
    | RoomMappingsProperties
  const body: Body[] = []

  // @todo ignore general

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    body.push({
      index: {
        _index: config.elasticsearch.index.room,
        _id: doc._id.toHexString()
      }
    })
    body.push({
      name: { kuromoji: doc.name, ngram: doc.name },
      status:
        doc.status === db.RoomStatusEnum.OPEN
          ? db.RoomStatusEnum.OPEN
          : db.RoomStatusEnum.CLOSE
    })
  }

  const { body: bulkResponse } = await es.bulk({
    refresh: true,
    body: body
  })
  if (bulkResponse.errors) {
    const erroredDocuments = []
    bulkResponse.items.forEach((action, i) => {
      const operation = Object.keys(action)[0]
      if (action[operation].error) {
        erroredDocuments.push({
          status: action[operation].status,
          error: action[operation].error,
          operation: body[i * 2],
          document: body[i * 2 + 1]
        })
      }
    })
    logger.error(JSON.stringify(erroredDocuments))
  }
}
