import { expect } from 'vitest'
import { ObjectId } from 'mongodb'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'
import { createTest } from '../../../test/testUtil.js'
import { collections } from '../db.js'
import { handleQueueEvent } from './index.js'

const test = await createTest(globalThis)

test('同じevent idを再配信しても返信数を二重加算しない', async ({ testDb }) => {
  const roomId = new ObjectId()
  const userId = new ObjectId()
  await collections(testDb).enter.insertOne({
    userId,
    roomId,
    unreadCounter: 0,
    replied: 0
  })
  const event: QueueWireEvent = {
    version: 1,
    eventId: 'event-reply-1',
    operationId: 'operation-reply-1',
    eventIndex: 0,
    destination: 'backend',
    type: 'reply',
    payload: { roomId: roomId.toHexString(), userId: userId.toHexString() },
    ordering: { key: `room:${roomId.toHexString()}`, revision: 1 },
    createdAt: new Date().toISOString()
  }

  await handleQueueEvent({ db: testDb, event })
  await handleQueueEvent({ db: testDb, event })

  const target = await collections(testDb).enter.findOne({ userId, roomId })
  expect(target?.replied).toBe(1)
})
