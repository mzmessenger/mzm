jest.mock('./logger')
jest.mock('./redis', () => {
  return {
    xread: jest.fn(),
    xdel: jest.fn()
  }
})

jest.mock('./sender')
import * as sender from './sender'

const sendToUser = jest.mocked(sender.sendToUser)

import { parser } from './consumer'

test('parser sendToUser', async () => {
  sendToUser.mockClear()

  const users = ['5cc9d148139370d11b706624', '5cc9d148139370d11b706625']
  const queues = users.map((user) => {
    return JSON.stringify({
      cmd: 'cmd',
      user: user
    })
  })

  const read = [
    [
      'stream:socket:message',
      [
        ['1558972034751-0', ['message', queues[0]]],
        ['1558972034751-1', ['message', queues[1]]]
      ]
    ]
  ]

  const nextId = await parser(read)

  expect(sendToUser.mock.calls.length).toBe(users.length)
  const messagses = read[0][1]
  const [lastId] = messagses[messagses.length - 1]
  expect(nextId).toStrictEqual(lastId)

  for (let i = 0; i < users.length; i++) {
    const [toUser, payload] = sendToUser.mock.calls[i]
    expect(toUser).toEqual(users[i])
    expect(JSON.stringify(payload)).toEqual(queues[i])
  }
})
