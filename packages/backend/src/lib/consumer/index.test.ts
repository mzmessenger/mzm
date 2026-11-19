import { expect, vi } from 'vitest'
vi.mock('./unread.js', () => ({ increment: vi.fn() }))
import { ObjectId } from 'mongodb'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'
import { createTest } from '../../../test/testUtil.js'
import { increment } from './unread.js'
import { handleQueueEvent } from './index.js'

const test = await createTest(globalThis)

test('event typeに対応するhandlerへdispatchする', async ({
  testDb
}) => {
  const event: QueueWireEvent = {
    version: 1,
    eventId: 'event-1',
    operationId: 'operation-1',
    eventIndex: 0,
    destination: 'backend',
    type: 'unread',
    payload: {
      roomId: new ObjectId().toHexString(),
      messageId: new ObjectId().toHexString()
    },
    ordering: { key: 'room:event-1', revision: 1 },
    createdAt: new Date().toISOString()
  }
  await handleQueueEvent({ db: testDb, event })
  expect(increment).toHaveBeenCalledWith(
    expect.objectContaining({
      db: testDb,
      event
    })
  )
})
