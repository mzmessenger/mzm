import type { MongoMemoryServer } from 'mongodb-memory-server'
import { vi, test, expect, beforeAll, afterAll } from 'vitest'
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

import { ObjectId } from 'mongodb'
import { mongoSetup, createRequest } from '../../test/testUtil'
import * as db from '../lib/db'
import { BadRequest } from '../lib/errors'
import { createRoom } from './rooms'

let mongoServer: MongoMemoryServer | null = null

beforeAll(async () => {
  const mongo = await mongoSetup()
  mongoServer = mongo.mongoServer
  await db.connect(mongo.uri)
})

afterAll(async () => {
  await db.close()
  await mongoServer?.stop()
})

test.each([
  ['aaa', 'aaa'],
  ['日本語　', '日本語'],
  ['🍣', '🍣']
])('createRoom success (%s, %s)', async (name, createdName) => {
  const userId = new ObjectId()
  const body = { name }
  const req = createRequest(userId, { body })

  const { id } = await createRoom(req)

  const created = await db.collections.rooms.findOne({
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
