import { expect } from 'vitest'
import { ObjectId } from 'mongodb'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'
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
  const event: QueueWireEvent<'removeUser'> = {
    version: 1,
    eventId: 'event-remove-1',
    operationId: 'operation-remove-1',
    eventIndex: 0,
    destination: 'auth',
    type: 'removeUser',
    payload: { userId: userId.toHexString() },
    ordering: { key: `user:${userId.toHexString()}`, revision: 1 },
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
  const event: QueueWireEvent<'removeUser'> = {
    version: 1,
    eventId: 'event-remove-orphan-enter',
    operationId: 'operation-remove-orphan-enter',
    eventIndex: 0,
    destination: 'auth',
    type: 'removeUser',
    payload: { userId: userId.toHexString() },
    ordering: { key: `user:${userId.toHexString()}`, revision: 1 },
    createdAt: new Date().toISOString()
  }

  await remove({ db: testDb, event })

  expect(await collections(testDb).enter.countDocuments({ userId })).toBe(0)
})
