import { expect, vi, test as baseTest } from 'vitest'
import { ObjectId } from 'mongodb'
import { isQueueWireEvent, type QueueWireEvent } from 'mzm-shared/src/lib/outbox'
import { getTestMongoClient } from '../../test/testUtil.js'
import { collections } from './db.js'
import { initializeOutboxIndexes, outbox } from './db/outbox.js'
import { removeUser } from './consumer.js'

vi.mock('./logger.js')

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({ task: _task }, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

function wireEvent(userId: string): QueueWireEvent {
  return {
    version: 1,
    eventId: `op-${userId}:0`,
    operationId: `op-${userId}`,
    eventIndex: 0,
    destination: 'auth' as const,
    type: 'removeUser' as const,
    payload: { userId },
    ordering: { key: `user:${userId}`, revision: 1 },
    createdAt: new Date().toISOString()
  }
}

test('removeUser archives the account and queues a backend follow-up event', async ({
  testDb
}) => {
  await initializeOutboxIndexes(testDb)

  const userId = new ObjectId()
  await collections(testDb).users.insertOne({
    _id: userId,
    githubId: `123-${userId.toHexString()}`
  })

  const event = wireEvent(userId.toHexString())
  expect(isQueueWireEvent(event)).toBe(true)

  await removeUser({ db: testDb, event })

  expect(await collections(testDb).users.findOne({ _id: userId })).toBeNull()
  expect(
    await collections(testDb).removed.findOne({ originId: userId })
  ).not.toBeNull()

  const followUp = await outbox(testDb)
    .find({ type: 'removeUser', destination: 'backend' })
    .toArray()
  expect(followUp.length).toBe(1)
  expect(followUp[0]?.status).toBe('pending')
  expect(followUp[0]?.payload).toEqual({ userId: userId.toHexString() })
  expect(
    isQueueWireEvent({
      ...followUp[0],
      operationId: followUp[0].operationId.toHexString()
    })
  ).toBe(true)
})

test('a repeated removeUser delivery does not duplicate the follow-up', async ({
  testDb
}) => {
  await initializeOutboxIndexes(testDb)

  const userId = new ObjectId()
  await collections(testDb).users.insertOne({
    _id: userId,
    githubId: `456-${userId.toHexString()}`
  })

  const event = wireEvent(userId.toHexString())
  await removeUser({ db: testDb, event })
  await removeUser({ db: testDb, event })

  expect(
    await outbox(testDb).countDocuments({
      type: 'removeUser',
      destination: 'backend',
      'payload.userId': userId.toHexString()
    })
  ).toBe(1)
})
