import { expect, test } from 'vitest'
import { serializedEventBytes } from './outbox.js'

test('serializes a versioned queue envelope', () => {
  expect(serializedEventBytes({ version: 1, eventId: 'event', operationId: 'operation', eventIndex: 0, destination: 'backend', type: 'unread', payload: { roomId: 'room', messageId: 'message' }, ordering: { key: 'room:room', revision: 1 }, createdAt: new Date().toISOString() })).toBeGreaterThan(0)
})
