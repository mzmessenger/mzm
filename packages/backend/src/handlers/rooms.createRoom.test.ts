import { vi, test, expect } from 'vitest'
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
  const { mockDb } = await import('../../test/mock.js')
  return { ...(await mockDb(await vi.importActual('../lib/db.js'))) }
})

import { ObjectId } from 'mongodb'
import { getTestMongoClient, createRequest } from '../../test/testUtil'
import { collections } from '../lib/db'
import { BadRequest } from 'mzm-shared/lib/errors'
import { createRoom } from './rooms'

const db = await getTestMongoClient()

test.each([
  ['aaa', 'aaa'],
  ['日本語　', '日本語'],
  ['🍣', '🍣']
])('createRoom success (%s, %s)', async (name, createdName) => {
  const userId = new ObjectId()
  const body = { name }
  const req = createRequest(userId, { body })

  const { id } = await createRoom(req)

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
  const req = createRequest(userId, { body })

  try {
    await createRoom(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
