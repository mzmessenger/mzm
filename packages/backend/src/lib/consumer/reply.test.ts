import { expect } from 'vitest'
import { ObjectId } from 'mongodb'
import { createTest } from '../../../test/testUtil.js'
import { collections } from '../db.js'
import { reply } from './reply.js'

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
  const event = {
    id: 'event-reply-1',
    type: 'reply' as const,
    payload: { roomId: roomId.toHexString(), userId: userId.toHexString() },
    createdAt: new Date().toISOString()
  }

  await reply({ db: testDb, event })
  await reply({ db: testDb, event })

  const target = await collections(testDb).enter.findOne({ userId, roomId })
  expect(target?.replied).toBe(1)
})
