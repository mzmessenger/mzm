import { vi, test, expect } from 'vitest'
vi.mock('./logger')
import { ExtWebSocket } from '../types.js'
import * as sender from './sender.js'

test('removeSocket', () => {
  const id = 'id-1'
  const user = 'username'
  const send = vi.fn()
  const socket = { id } as ExtWebSocket

  socket.send = send
  sender.saveSocket(id, user, socket)
  sender.removeSocket(id, user)
  sender.sendToUser(user, 'test')

  expect(send.mock.calls.length).toBe(0)
})

test('sendToUser', () => {
  sender.clear()

  const send = vi.fn()

  const save = (id: string, user: string) => {
    const socket = { id } as ExtWebSocket
    socket.send = send
    sender.saveSocket(id, user, socket)
  }

  const user = 'username'
  save('id-1', user)
  save('id-2', user)

  sender.sendToUser(user, 'test')

  expect(send.mock.calls.length).toBe(2)
})
