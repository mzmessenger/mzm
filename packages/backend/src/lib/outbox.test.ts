import { expect } from 'vitest'
import { createTest } from '../../test/testUtil.js'
import { createSocketOperation, initializeOutboxIndexes } from './outbox.js'

const test = await createTest(globalThis)

test('createSocketOperation persists an empty socket response', async ({ testDb }) => {
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
