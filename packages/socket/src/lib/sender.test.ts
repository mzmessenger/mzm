jest.mock('./logger')
import { ExtWebSocket } from '../types'
import * as sender from './sender'

test('removeSocket', () => {
  const id = 'id-1'
  const user = 'username'
  const send = jest.fn()
  const socket = { id } as ExtWebSocket

  socket.send = send
  sender.saveSocket(id, user, socket)
  sender.removeSocket(id, user)
  sender.sendToUser(user, 'test')

  expect(send.mock.calls.length).toBe(0)
})

test('sendToUser', () => {
  sender.clear()

  const send = jest.fn()

  const save = (id, user) => {
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
