import { expect } from 'vitest'
import { ObjectId } from 'mongodb'
import type { QueueEvent } from 'mzm-shared/src/lib/queue'
import { createTest } from '../../../test/testUtil.js'
import { collections } from '../db.js'
import { remove } from './remove.js'

const test = await createTest(globalThis)

test('ユーザーをremovedへ移して再配信を安全に処理する', async ({ testDb }) => {
  const userId = new ObjectId()
  await collections(testDb).users.insertOne({
    _id: userId,
    account: 'removed-user',
    roomOrder: []
  })
  const event: QueueEvent<'removeUser'> = {
    id: 'event-remove-1',
    type: 'removeUser',
    payload: { userId: userId.toHexString() },
    createdAt: new Date().toISOString()
  }

  await remove({ db: testDb, event })
  await remove({ db: testDb, event })

  expect(await collections(testDb).users.findOne({ _id: userId })).toBeNull()
  expect(
    await collections(testDb).removed.findOne({ originId: userId })
  ).not.toBeNull()
})

test('ユーザー削除後の再配信でも残存enterを削除する', async ({ testDb }) => {
  const userId = new ObjectId()
  await collections(testDb).enter.insertOne({
    userId,
    roomId: new ObjectId(),
    unreadCounter: 0,
    replied: 0
  })
  const event: QueueEvent<'removeUser'> = {
    id: 'event-remove-orphan-enter',
    type: 'removeUser',
    payload: { userId: userId.toHexString() },
    createdAt: new Date().toISOString()
  }

  await remove({ db: testDb, event })

  expect(await collections(testDb).enter.countDocuments({ userId })).toBe(0)
})
