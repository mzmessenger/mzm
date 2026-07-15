import { expect } from 'vitest'
import { ObjectId } from 'mongodb'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'
import { createTest } from '../../../test/testUtil.js'
import { collections } from '../db.js'
import { handleQueueEvent } from './index.js'

const test = await createTest(globalThis)

test('同じevent idを再配信しても未読数を二重加算しない', async ({ testDb }) => {
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
    eventId: 'event-unread-1',
    operationId: 'operation-unread-1',
    eventIndex: 0,
    destination: 'backend',
    type: 'unread',
    payload: {
      roomId: roomId.toHexString(),
      messageId: new ObjectId().toHexString()
    },
    ordering: { key: `room:${roomId.toHexString()}`, revision: 1 },
    createdAt: new Date().toISOString()
  }

  await handleQueueEvent({ db: testDb, event })
  await handleQueueEvent({ db: testDb, event })

  const target = await collections(testDb).enter.findOne({ userId, roomId })
  expect(target?.unreadCounter).toBe(1)
})
