import { expect } from 'vitest'
import { ObjectId } from 'mongodb'
import { createTest } from '../../../test/testUtil.js'
import { collections } from '../db.js'
import { increment } from './unread.js'

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
  const event = {
    id: 'event-unread-1',
    type: 'unread' as const,
    payload: {
      roomId: roomId.toHexString(),
      messageId: new ObjectId().toHexString()
    },
    createdAt: new Date().toISOString()
  }

  await increment({ db: testDb, event })
  await increment({ db: testDb, event })

  const target = await collections(testDb).enter.findOne({ userId, roomId })
  expect(target?.unreadCounter).toBe(1)
})
