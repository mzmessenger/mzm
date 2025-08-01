/* eslint-disable no-empty-pattern */
import { vi, test as baseTest, expect } from 'vitest'
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
  const actual =
    await vi.importActual<typeof import('../lib/db.js')>('../lib/db.js')
  return { ...actual, mongoClient: vi.fn() }
})

import { ObjectId } from 'mongodb'
import { BadRequest } from 'mzm-shared/src/lib/errors'
import { getTestMongoClient } from '../../test/testUtil.js'
import { collections } from '../lib/db.js'
import { createRoom } from './rooms.js'

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

test.for([
  ['aaa', 'aaa'],
  ['日本語　', '日本語'],
  ['🍣', '🍣']
])('createRoom success (%s, %s)', async ([name, createdName], { testDb }) => {
  const userId = new ObjectId()
  const body = { name }

  const { id } = await createRoom(testDb, { userId, body })

  const db = await getTestMongoClient(globalThis)
  const created = await collections(db).rooms.findOne({
    _id: new ObjectId(id)
  })

  expect(created?.name).toStrictEqual(createdName)
  expect(created?.createdBy).toStrictEqual(userId.toHexString())
})

test.for([
  ['slash', '/hoge/fuga'],
  ['00A0', '\u00A0']
])('createRoom fail', async ([, name], { testDb }) => {
  expect.assertions(1)

  const userId = new ObjectId()
  const body = { name }

  try {
    await createRoom(testDb, { userId, body })
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
