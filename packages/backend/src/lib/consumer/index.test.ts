import { expect, vi } from 'vitest'
vi.mock('./unread.js', () => ({ increment: vi.fn() }))
import { ObjectId } from 'mongodb'
import { createTest } from '../../../test/testUtil.js'
import { increment } from './unread.js'
import { handleQueueEvent } from './index.js'

const test = await createTest(globalThis)

test('event typeに対応するhandlerへdispatchする', async ({
  testDb,
  testRedis
}) => {
  const event = {
    id: 'event-1',
    type: 'unread' as const,
    payload: {
      roomId: new ObjectId().toHexString(),
      messageId: new ObjectId().toHexString()
    },
    createdAt: new Date().toISOString()
  }
  await handleQueueEvent({ db: testDb, publisher: testRedis, event })
  expect(increment).toHaveBeenCalledWith({ db: testDb, event })
})
