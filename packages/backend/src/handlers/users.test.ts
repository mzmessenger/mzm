import { vi, test, expect, beforeEach } from 'vitest'
vi.mock('../lib/logger')
vi.mock('../lib/db.js', async () => {
  const { mockDb } = await import('../../test/mock.js')
  return { ...(await mockDb(await vi.importActual('../lib/db.js'))) }
})

import { ObjectId } from 'mongodb'
import type { REQUEST } from 'mzm-shared/type/api'
import {
  dropCollection,
  createRequest,
  getTestMongoClient
} from '../../test/testUtil'
import { BadRequest, NotFound } from 'mzm-shared/lib/errors'
import { collections, COLLECTION_NAMES } from '../lib/db'
import { update, getUserInfo, updateAccount } from './users'

beforeEach(async () => {
  const client = await getTestMongoClient()
  await dropCollection(client, COLLECTION_NAMES.USERS)
})

const db = await getTestMongoClient()

test('update', async () => {
  const userId = new ObjectId()
  const account = `aaa-${userId.toHexString()}`

  await collections(db).users.insertOne({ _id: userId, account, roomOrder: [] })

  const body: Partial<REQUEST['/api/user/@me']['PUT']['body']> = {
    account: 'changed-account'
  }
  const req = createRequest(userId, { body })

  const user = await update(req)

  const found = await collections(db).users.findOne({ _id: userId })

  expect(user.id).toStrictEqual(found?._id.toHexString())
  expect(user.account).toStrictEqual(found?.account)
  expect(found?.account).toStrictEqual(body.account)
})

test('update failed: exists account', async () => {
  const userId = new ObjectId()
  const account = 'aaa'

  await collections(db).users.insertOne({ _id: userId, account, roomOrder: [] })
  await collections(db).users.insertOne({
    _id: new ObjectId(),
    account: 'exists',
    roomOrder: []
  })

  const req = createRequest<REQUEST['/api/user/@me']['PUT']['body']>(userId, {
    body: {
      account: 'exists'
    }
  })

  await expect(update(req)).rejects.toThrow(BadRequest)
})

test('getUserInfo', async () => {
  const userId = new ObjectId()
  const account = 'aaa'

  await collections(db).users.insertOne({ _id: userId, account, roomOrder: [] })

  const body = { account }
  const req = createRequest(userId, { body })

  const user = await getUserInfo(req)

  const found = await collections(db).users.findOne({ _id: userId })

  expect(user.id).toStrictEqual(found?._id.toHexString())
  expect(user.account).toStrictEqual(found?.account)
})

test('getUserInfo before signUp', async () => {
  expect.assertions(1)

  const userId = new ObjectId()
  const account = ''

  await collections(db).users.insertOne({
    _id: userId,
    account,
    roomOrder: []
  })

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
