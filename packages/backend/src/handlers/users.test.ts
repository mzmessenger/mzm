jest.mock('../lib/logger')

import { ObjectId } from 'mongodb'
import type { REQUEST } from 'mzm-shared/type/api'
import { mongoSetup, dropCollection, createRequest } from '../../jest/testUtil'
import { BadRequest, NotFound } from '../lib/errors'
import * as db from '../lib/db'
import { update, getUserInfo, updateAccount } from './users'

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

test('update', async () => {
  const userId = new ObjectId()
  const account = `aaa-${userId.toHexString()}`

  await db.collections.users.insertOne({ _id: userId, account, roomOrder: [] })

  const body: Partial<REQUEST['/api/user/@me']['PUT']['body']> = {
    account: 'changed-account'
  }
  const req = createRequest(userId, { body })

  const user = await update(req)

  const found = await db.collections.users.findOne({ _id: userId })

  expect(user.id).toStrictEqual(found._id.toHexString())
  expect(user.account).toStrictEqual(found.account)
  expect(found.account).toStrictEqual(body.account)
})

test('update failed: exists account', async () => {
  const userId = new ObjectId()
  const account = 'aaa'

  await db.collections.users.insertOne({ _id: userId, account, roomOrder: [] })
  await db.collections.users.insertOne({
    _id: new ObjectId(),
    account: 'exists',
    roomOrder: []
  })

  const body: Partial<REQUEST['/api/user/@me']['PUT']['body']> = {
    account: 'exists'
  }
  const req = createRequest(userId, { body })

  await expect(update(req)).rejects.toThrow(BadRequest)
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
