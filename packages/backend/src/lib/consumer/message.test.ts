import { expect, test, vi } from 'vitest'
vi.mock('../fetchStreaming.js', () => ({ sendToUser: vi.fn() }))
import { TO_CLIENT_CMD } from 'mzm-shared/src/type/socket'
import { sendToUser } from '../fetchStreaming.js'
import { message } from './message.js'

test('message eventを接続中のユーザーへ配信する', async () => {
  const event = {
    id: 'event-message-1',
    type: 'message' as const,
    payload: { cmd: TO_CLIENT_CMD.CLIENT_RELOAD, user: 'user-1' },
    createdAt: new Date().toISOString()
  }
  await message({ event })
  expect(sendToUser).toHaveBeenCalledTimes(1)
})
