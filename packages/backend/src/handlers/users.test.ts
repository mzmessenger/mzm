import { vi, test, expect, beforeAll } from 'vitest'
vi.mock('../lib/db.js', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/db.js')>('../lib/db.js')
  return { ...actual, mongoClient: vi.fn() }
})

import type { API } from 'mzm-shared/src/api/universal'
import { ObjectId } from 'mongodb'
import { BadRequest, NotFound } from 'mzm-shared/src/lib/errors'
import {
  getTestMongoClient
} from '../../test/testUtil.js'
import { collections } from '../lib/db.js'
import { update, getUserInfo } from './users.js'

beforeAll(async () => {
  const { mongoClient } = await import('../lib/db.js')
  const { getTestMongoClient } = await import('../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

test('update', async ({ task }) => {
  const userId = new ObjectId()
  const account = `${task.id}-aaa`

  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertOne({ _id: userId, account, roomOrder: [] })

  const body: API['/api/user/@me']['PUT']['request']['body'] = {
    account: `${task.id}-changed-account`
  }

  const user = await update(userId, body)

  const found = await collections(db).users.findOne({ _id: userId })

  expect(user.id).toStrictEqual(found?._id.toHexString())
  expect(user.account).toStrictEqual(found?.account)
  expect(found?.account).toStrictEqual(body.account)
})

test('update failed: exists account', async ({ task }) => {
  const userId = new ObjectId()
  const account = 'aaa'

  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertOne({ _id: userId, account, roomOrder: [] })
  const existsAccount = `${task.id}-exists`
  await collections(db).users.insertOne({
    _id: new ObjectId(),
    account: existsAccount,
    roomOrder: []
  })

  const body = {
    account: existsAccount
  }

  await expect(update(userId, body)).rejects.toThrow(BadRequest)
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

  try {
    await update(userId, body)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('getUserInfo', async () => {
  const userId = new ObjectId()
  const account = 'aaa'

  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertOne({ _id: userId, account, roomOrder: [] })

  const user = await getUserInfo(userId)

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

  try {
    await getUserInfo(userId)
  } catch (e) {
    expect(e instanceof NotFound).toStrictEqual(true)
  }
})
