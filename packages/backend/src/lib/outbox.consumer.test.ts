import { Collection, ObjectId, type ClientSession, type MongoClient } from 'mongodb'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'
import { expect, vi } from 'vitest'
import { createTest } from '../../test/testUtil.js'
import { collections } from './db.js'
import { consumerReceipts } from './db/outbox.js'
import { acceptConsumerEvent } from './outbox.js'
import { increment } from './consumer/unread.js'

const test = await createTest(globalThis)

function unreadEvent(
  eventId: string,
  roomId: string,
  revision: number
): QueueWireEvent<'unread'> {
  return {
    version: 1,
    eventId,
    operationId: new ObjectId().toHexString(),
    eventIndex: 0,
    destination: 'backend',
    type: 'unread',
    payload: { roomId, messageId: new ObjectId().toHexString() },
    ordering: { key: `room:${roomId}`, revision },
    createdAt: new Date().toISOString()
  }
}

test('applies unread increments when revisions arrive out of order', async ({
  testDb
}) => {
  const userId = new ObjectId()
  const roomId = new ObjectId()
  await collections(testDb).enter.insertOne({
    userId,
    roomId,
    unreadCounter: 0,
    replied: 0
  })

  const newer = unreadEvent('event-rev-2', roomId.toHexString(), 2)
  const older = unreadEvent('event-rev-1', roomId.toHexString(), 1)
  for (const event of [newer, older]) {
    expect(
      await acceptConsumerEvent(testDb, event, async (session) => {
        await increment({ db: testDb, event, session })
      })
    ).toBe(true)
  }

  const entry = await collections(testDb).enter.findOne({ userId, roomId })
  expect(entry?.unreadCounter).toBe(2)
})

test('does not apply an unread increment twice for the same event', async ({
  testDb
}) => {
  const userId = new ObjectId()
  const roomId = new ObjectId()
  await collections(testDb).enter.insertOne({
    userId,
    roomId,
    unreadCounter: 0,
    replied: 0
  })

  const event = unreadEvent(crypto.randomUUID(), roomId.toHexString(), 1)
  for (let attempt = 0; attempt < 2; attempt++) {
    expect(
      await acceptConsumerEvent(testDb, event, async (session) => {
        await increment({ db: testDb, event, session })
      })
    ).toBe(attempt === 0)
  }

  const entry = await collections(testDb).enter.findOne({ userId, roomId })
  expect(entry?.unreadCounter).toBe(1)
})

test('recognizes an existing receipt without issuing a duplicate insert', async ({
  testDb
}) => {
  const roomId = new ObjectId()
  const event = unreadEvent(crypto.randomUUID(), roomId.toHexString(), 1)
  const receipts = consumerReceipts(testDb)
  await receipts.insertOne({
    _id: `backend:${event.eventId}`,
    consumerName: 'backend',
    eventId: event.eventId,
    processedAt: new Date()
  })

  const insertSpy = vi
    .spyOn(Collection.prototype, 'insertOne')
    .mockImplementation(async () => {
      throw new Error('E11000 duplicate key error')
    })
  let mutationCount = 0
  try {
    expect(
      await acceptConsumerEvent(testDb, event, async () => {
        mutationCount++
      })
    ).toBe(false)
    expect(mutationCount).toBe(0)
  expect(insertSpy).not.toHaveBeenCalled()
  } finally {
    insertSpy.mockRestore()
  }
})

test('uses the final transaction attempt result after a retry', async ({
  testDb
}) => {
  const event = unreadEvent(crypto.randomUUID(), new ObjectId().toHexString(), 1)
  let updateAttempts = 0
  const updateSpy = vi
    .spyOn(Collection.prototype, 'updateOne')
    .mockImplementation(async () => {
      updateAttempts++
      return {
        acknowledged: true,
        matchedCount: 0,
        modifiedCount: 0,
        upsertedCount: updateAttempts === 1 ? 1 : 0,
        upsertedId: updateAttempts === 1 ? new ObjectId() : null
      }
    })
  const retryingSession = {
    withTransaction: async (callback: () => Promise<void>) => {
      await callback()
      await callback()
    }
  } as unknown as ClientSession
  const retryingDb = {
    db: () => testDb.db(),
    withSession: async (callback: (session: ClientSession) => Promise<void>) =>
      await callback(retryingSession)
  } as unknown as MongoClient

  try {
    const accepted = await acceptConsumerEvent(retryingDb, event, async () => {})
    expect(accepted).toBe(false)
    expect(updateSpy).toHaveBeenCalledTimes(2)
  } finally {
    updateSpy.mockRestore()
  }
})
