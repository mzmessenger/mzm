import { vi, test, expect, beforeEach, beforeAll } from 'vitest'
vi.mock('../lib/db.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/db.js')>(
    '../lib/db.js'
  )
  return { ...actual, mongoClient: vi.fn() }
})

import type { API } from 'mzm-shared/src/api/universal'
import { ObjectId } from 'mongodb'
import { BadRequest, NotFound } from 'mzm-shared/src/lib/errors'
import {
  dropCollection,
  createRequest,
  getTestMongoClient
} from '../../test/testUtil.js'
import { collections, COLLECTION_NAMES } from '../lib/db.js'
import { update, getUserInfo } from './users.js'

beforeAll(async () => {
  const { mongoClient } = await import('../lib/db.js')
  const { getTestMongoClient } = await import('../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

beforeEach(async () => {
  const client = await getTestMongoClient(globalThis)
  await dropCollection(client, COLLECTION_NAMES.USERS)
})

test('update', async () => {
  const userId = new ObjectId()
  const account = `aaa-${userId.toHexString()}`

  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertOne({ _id: userId, account, roomOrder: [] })

  const body: API['/api/user/@me']['PUT']['request']['body'] = {
    account: 'changed-account'
  }
  const req = createRequest(userId, { body })

  const user = await update.handler(req)

  const found = await collections(db).users.findOne({ _id: userId })

  expect(user.id).toStrictEqual(found?._id.toHexString())
  expect(user.account).toStrictEqual(found?.account)
  expect(found?.account).toStrictEqual(body.account)
})

test('update failed: exists account', async () => {
  const userId = new ObjectId()
  const account = 'aaa'

  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertOne({ _id: userId, account, roomOrder: [] })
  await collections(db).users.insertOne({
    _id: new ObjectId(),
    account: 'exists',
    roomOrder: []
  })

  const req = createRequest<API['/api/user/@me']['PUT']['request']['body']>(
    userId,
    {
      body: {
        account: 'exists'
      }
    }
  )

  await expect(update.handler(req)).rejects.toThrow(BadRequest)
})

test.each([
  ['null', null],
  ['undefined', undefined],
  ['空文字', ''],
  ['space', ' '],
  ['space2', '　'],
  ['space3', '　 　']
])('update fail (account: %s)', async (_label, account) => {
  expect.assertions(1)

  const userId = new ObjectId()

  const body = { account }
  const req = createRequest(userId, { body })

  try {
    await update.handler(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('getUserInfo', async () => {
  const userId = new ObjectId()
  const account = 'aaa'

  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertOne({ _id: userId, account, roomOrder: [] })

  const body = { account }
  const req = createRequest(userId, { body })

  const user = await getUserInfo.handler(req)

  const found = await collections(db).users.findOne({ _id: userId })

  expect(user.id).toStrictEqual(found?._id.toHexString())
  expect(user.account).toStrictEqual(found?.account)
})

test('getUserInfo before signUp', async () => {
  expect.assertions(1)

  const userId = new ObjectId()
  const account = ''

  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertOne({
    _id: userId,
    account,
    roomOrder: []
  })

  const req = createRequest(userId, {})

  try {
    await getUserInfo.handler(req)
  } catch (e) {
    expect(e instanceof NotFound).toStrictEqual(true)
  }
})
