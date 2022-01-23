jest.mock('../lib/logger')

import { ObjectId } from 'mongodb'
import { mongoSetup, dropCollection, createRequest } from '../../jest/testUtil'
import { BadRequest, NotFound } from '../lib/errors'
import * as db from '../lib/db'
import { getUserInfo, updateAccount } from './users'

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

test('getUserInfo', async () => {
  const userId = new ObjectId()
  const account = 'aaa'

  await db.collections.users.insertOne({ _id: userId, account, roomOrder: [] })

  const body = { account }
  const req = createRequest(userId, { body })

  const user = await getUserInfo(req)

  const found = await db.collections.users.findOne({ _id: userId })

  expect(user.id).toStrictEqual(found._id.toHexString())
  expect(user.account).toStrictEqual(found.account)
})

test('getUserInfo before signUp', async () => {
  expect.assertions(1)

  const userId = new ObjectId()
  const account = null

  await db.collections.users.insertOne({ _id: userId, account, roomOrder: [] })

  const req = createRequest(userId, {})

  try {
    await getUserInfo(req)
  } catch (e) {
    expect(e instanceof NotFound).toStrictEqual(true)
  }
})

test.each([
  ['null', null],
  ['undefined', undefined],
  ['空文字', ''],
  ['space', ' '],
  ['space2', '　'],
  ['space3', '　 　']
])('updateAccount fail (account: %s)', async (_label, account) => {
  expect.assertions(1)

  const userId = new ObjectId()

  const body = { account }
  const req = createRequest(userId, { body })

  try {
    await updateAccount(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})
