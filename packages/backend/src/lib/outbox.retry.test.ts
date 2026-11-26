import { expect } from 'vitest'
import { ObjectId } from 'mongodb'
import { createTest } from '../../test/testUtil.js'
import { initializeOutboxIndexes, outbox } from './db/outbox.js'
import { createSocketOperation } from './outbox.js'

const test = await createTest(globalThis)

test('createSocketOperation does not duplicate events when the transaction retries', async ({
  testDb
}) => {
  await initializeOutboxIndexes(testDb)
  const room = '0123456789abcdef01234567'

  // Force exactly one transaction retry without test-only commands (CI runs
  // plain mongo:5): commit a competing write to a document the transaction
  // then writes to, producing a labeled WriteConflict and a driver retry.
  // Before the fix, events pushed during the first attempt stayed in the
  // callback closure and were re-pushed, doubling every event of the message.
  const sentinel = testDb.db().collection<{ _id: string; n: number }>(
    'retry_sentinel'
  )
  await sentinel.insertOne({ _id: 's', n: 0 })

  let conflicted = false
  let attempts = 0
  const operation = await createSocketOperation({
    db: testDb,
    subject: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    request: { cmd: 'message:send' },
    async run({ session, emit }) {
      attempts += 1
      emit({
        type: 'unread',
        payload: { roomId: room, messageId: room },
        orderingKey: `room:${room}`
      })
      emit({
        type: 'unread',
        payload: { roomId: room, messageId: room },
        orderingKey: `user:${room}`
      })
      emit({
        type: 'unread',
        payload: { roomId: room, messageId: '0123456789abcdef01234568' },
        orderingKey: `user:0123456789abcdef01234568`
      })
      if (!conflicted) {
        conflicted = true
        // Committed outside this transaction, after the transaction snapshot.
        await sentinel.updateOne({ _id: 's' }, { $inc: { n: 1 } })
      }
      // Write-write conflict on the first attempt; the retry gets a fresh
      // snapshot that already includes the external write, so it succeeds.
      await sentinel.updateOne({ _id: 's' }, { $inc: { n: 1 } }, { session })
      return { ok: true }
    }
  })

  // The test is only meaningful if the retry really happened.
  expect(attempts).toBe(2)
  const events = await outbox(testDb)
    .find({ operationId: new ObjectId(operation.operationId) })
    .toArray()
  expect(events.length).toBe(3)
  expect(events.map((event) => event.type)).toEqual([
    'unread',
    'unread',
    'unread'
  ])
  expect(new Set(events.map((event) => event.eventId)).size).toBe(3)
})
