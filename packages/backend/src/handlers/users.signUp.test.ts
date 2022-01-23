jest.mock('../lib/logger')
jest.mock('../lib/redis', () => {
  return {
    lock: jest.fn(() => Promise.resolve(true)),
    release: jest.fn()
  }
})

import { ObjectId } from 'mongodb'
import { mongoSetup, dropCollection, createRequest } from '../../jest/testUtil'
import { BadRequest } from '../lib/errors'
import * as db from '../lib/db'
import { initGeneral } from '../logic/rooms'
import { signUp } from './users'

let mongoServer = null
let mongoUri = null

beforeAll(async () => {
  const mongo = await mongoSetup()
  mongoServer = mongo.mongoServer
  mongoUri = mongo.uri
  return await db.connect(mongo.uri)
})

afterAll(async () => {
  await db.close()
  await mongoServer.stop()
})

beforeEach(async () => {
  return dropCollection(mongoUri, db.COLLECTION_NAMES.MESSAGES)
})

test('signUp success', async () => {
  const userId = new ObjectId()
  const account = 'aaa'

  await initGeneral()

  const body = { account }
  const req = createRequest(userId, { body })

  await signUp(req)
})

test.each([
  ['aaa', 'aaa'],
  ['test', 'TeSt']
])('signUp already exist (%s, %s)', async (account, createAccount) => {
  expect.assertions(1)

  const created = new ObjectId()

  await db.collections.users.insertOne({
    _id: created,
    account: account,
    roomOrder: []
  })

  const body = { account: createAccount }
  const req = createRequest(new ObjectId(), { body })

  try {
    await signUp(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test.each([
  ['null', null],
  ['undefined', undefined],
  ['空文字', ''],
  ['space', ' ']
])('signUp fail (account: %s)', async (_label, account) => {
  expect.assertions(1)

  const userId = new ObjectId()

  const body = { account }
  const req = createRequest(userId, { body })

  try {
    await signUp(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
