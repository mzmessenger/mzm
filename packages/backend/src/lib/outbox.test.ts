import { expect } from 'vitest'
import { TO_CLIENT_CMD } from 'mzm-shared/src/type/socket'
import { createTest } from '../../test/testUtil.js'
import { initializeOutboxIndexes, outbox } from './db/outbox.js'
import { createSocketOperation } from './outbox.js'

const test = await createTest(globalThis)

test('createSocketOperation persists an empty socket response', async ({
  testDb
}) => {
  await initializeOutboxIndexes(testDb)

  const operation = await createSocketOperation({
    db: testDb,
    subject: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    request: { cmd: 'rooms:get' },
    async run() {
      return undefined
    }
  })

  expect(operation.response).toBeNull()
})

test('createSocketOperation rejects oversized events without committing mutation', async ({
  testDb
}) => {
  await initializeOutboxIndexes(testDb)
  const mutationId = crypto.randomUUID()
  const idempotencyKey = crypto.randomUUID()
  const mutationCollection = testDb.db().collection<{ _id: string }>('outbox_size_mutation_test')

  await expect(
    createSocketOperation({
      db: testDb,
      subject: crypto.randomUUID(),
      idempotencyKey,
      request: { cmd: 'message:send' },
      async run({ session, emit }) {
        await mutationCollection.insertOne({ _id: mutationId }, { session })
        emit({
          type: 'message',
          payload: {
            cmd: TO_CLIENT_CMD.MESSAGE_RECEIVE,
            user: null,
            room: '0123456789abcdef01234567',
            message: {
              id: crypto.randomUUID(),
              userId: crypto.randomUUID(),
              message: 'x'.repeat(130 * 1024),
              iine: 0,
              updated: false,
              removed: false,
              createdAt: new Date().toISOString(),
              updatedAt: null,
              userAccount: 'test-user',
              icon: null
            }
          },
          orderingKey: 'room:0123456789abcdef01234567'
        })
        return { saved: true }
      }
    })
  ).rejects.toMatchObject({ status: 400 })

  expect(await mutationCollection.findOne({ _id: mutationId })).toBeNull()
  expect(await outbox(testDb).countDocuments({})).toBe(0)
})

test('createSocketOperation reports an idempotency-key conflict as HTTP 409', async ({
  testDb
}) => {
  await initializeOutboxIndexes(testDb)
  const subject = crypto.randomUUID()
  const idempotencyKey = crypto.randomUUID()
  const common = { db: testDb, subject, idempotencyKey }
  await createSocketOperation({
    ...common,
    request: { cmd: 'rooms:get', room: 'first' },
    async run() {
      return { ok: true }
    }
  })

  await expect(
    createSocketOperation({
      ...common,
      request: { cmd: 'rooms:get', room: 'second' },
      async run() {
        return { ok: true }
      }
    })
  ).rejects.toMatchObject({ status: 409 })
})
