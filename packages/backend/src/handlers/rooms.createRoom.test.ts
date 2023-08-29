import { vi, test, expect, beforeAll } from 'vitest'
vi.mock('../lib/logger')
vi.mock('../lib/redis', () => {
  return {
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})
vi.mock('../lib/elasticsearch/index', () => {
  return {
    client: {}
  }
})
vi.mock('../lib/db.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/db.js')>(
    '../lib/db.js'
  )
  return { ...actual, mongoClient: vi.fn() }
})

import type { API } from 'mzm-shared/type/api'
import { ObjectId } from 'mongodb'
import { BadRequest } from 'mzm-shared/lib/errors'
import { createRequest, getTestMongoClient } from '../../test/testUtil.js'
import { collections } from '../lib/db.js'
import { createRoom } from './rooms.js'

type APIType = API['/api/rooms']['POST']

beforeAll(async () => {
  const { mongoClient } = await import('../lib/db.js')
  const { getTestMongoClient } = await import('../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

test.each([
  ['aaa', 'aaa'],
  ['日本語　', '日本語'],
  ['🍣', '🍣']
])('createRoom success (%s, %s)', async (name, createdName) => {
  const userId = new ObjectId()
  const body = { name }
  const req = createRequest<APIType['REQUEST']['body']>(userId, { body })

  const { id } = await createRoom.handler(req)

  const db = await getTestMongoClient(globalThis)
  const created = await collections(db).rooms.findOne({
    _id: new ObjectId(id)
  })

  expect(created?.name).toStrictEqual(createdName)
  expect(created?.createdBy).toStrictEqual(userId.toHexString())
})

test.each([
  ['slash', '/hoge/fuga'],
  ['00A0', '\u00A0']
])('createRoom fail', async (_label, name) => {
  expect.assertions(1)

  const userId = new ObjectId()
  const body = { name }
  const req = createRequest<APIType['REQUEST']['body']>(userId, { body })

  try {
    await createRoom.handler(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
