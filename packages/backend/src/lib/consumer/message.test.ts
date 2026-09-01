import { expect, test, vi } from 'vitest'
vi.mock('../fetchStreaming.js', () => ({ sendToUser: vi.fn() }))
import { TO_CLIENT_CMD } from 'mzm-shared/src/type/socket'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'
import { sendToUser } from '../fetchStreaming.js'
import { message } from './message.js'

test('message eventを接続中のユーザーへ配信する', async () => {
  const event: QueueWireEvent<'message'> = {
    version: 1,
    eventId: 'event-message-1',
    operationId: 'operation-message-1',
    eventIndex: 0,
    destination: 'backend',
    type: 'message' as const,
    payload: { cmd: TO_CLIENT_CMD.CLIENT_RELOAD, user: 'user-1' },
    ordering: { key: 'user:user-1', revision: 1 },
    createdAt: new Date().toISOString()
  }
  await message({ event })
  expect(sendToUser).toHaveBeenCalledTimes(1)
})
