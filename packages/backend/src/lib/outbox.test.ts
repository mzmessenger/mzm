import { expect } from 'vitest'
import { createTest } from '../../test/testUtil.js'
import { initializeOutboxIndexes } from './db/outbox.js'
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
