/* eslint-disable no-empty-pattern */
import { vi, test as baseTest, expect } from 'vitest'
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

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

test('update', async ({ task, testDb }) => {
  const userId = new ObjectId()
  const account = `${task.id}-aaa`

  await collections(testDb).users.insertOne({ _id: userId, account, roomOrder: [] })

  const body: API['/api/user/@me']['PUT']['request']['body'] = {
    account: `${task.id}-changed-account`
  }

  const user = await update(testDb, userId, body)

  const found = await collections(testDb).users.findOne({ _id: userId })

  expect(user.id).toStrictEqual(found?._id.toHexString())
  expect(user.account).toStrictEqual(found?.account)
  expect(found?.account).toStrictEqual(body.account)
})

test('update failed: exists account', async ({ task, testDb }) => {
  const userId = new ObjectId()
  const account = 'aaa'

  await collections(testDb).users.insertOne({ _id: userId, account, roomOrder: [] })
  const existsAccount = `${task.id}-exists`
  await collections(testDb).users.insertOne({
    _id: new ObjectId(),
    account: existsAccount,
    roomOrder: []
  })

  const body = {
    account: existsAccount
  }

  await expect(update(testDb, userId, body)).rejects.toThrow(BadRequest)
})

test.for([
  ['null', null],
  ['undefined', undefined],
  ['空文字', ''],
  ['space', ' '],
  ['space2', '　'],
  ['space3', '　 　']
] as const)('update fail (account: %s)', async ([, account], { testDb }) => {
  expect.assertions(1)

  const userId = new ObjectId()

  const body = { account }

  try {
    await update(testDb, userId, body)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('getUserInfo', async ({ testDb }) => {
  const userId = new ObjectId()
  const account = 'aaa'

  await collections(testDb).users.insertOne({ _id: userId, account, roomOrder: [] })

  const user = await getUserInfo(testDb, userId)

  const found = await collections(testDb).users.findOne({ _id: userId })

  expect(user.id).toStrictEqual(found?._id.toHexString())
  expect(user.account).toStrictEqual(found?.account)
})

test('getUserInfo before signUp', async ({ testDb }) => {
  expect.assertions(1)

  const userId = new ObjectId()
  const account = ''

  await collections(testDb).users.insertOne({
    _id: userId,
    account,
    roomOrder: []
  })

  try {
    await getUserInfo(testDb, userId)
  } catch (e) {
    expect(e instanceof NotFound).toStrictEqual(true)
  }
})
