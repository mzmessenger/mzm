jest.mock('../lib/logger')
jest.mock('../lib/redis', () => {
  return {
    lock: jest.fn(() => Promise.resolve(true)),
    release: jest.fn()
  }
})
jest.mock('../lib/elasticsearch/index', () => {
  return {
    client: {}
  }
})

import { ObjectId } from 'mongodb'
import { mongoSetup, createRequest } from '../../jest/testUtil'
import * as db from '../lib/db'
import { BadRequest } from '../lib/errors'
import { createRoom } from './rooms'

let mongoServer = null

beforeAll(async () => {
  const mongo = await mongoSetup()
  mongoServer = mongo.mongoServer
  return await db.connect(mongo.uri)
})

afterAll(async () => {
  await db.close()
  await mongoServer.stop()
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

  expect(created.name).toStrictEqual(createdName)
  expect(created.createdBy).toStrictEqual(userId.toHexString())
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
