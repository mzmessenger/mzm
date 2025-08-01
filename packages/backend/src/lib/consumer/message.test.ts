import { vi, expect } from 'vitest'
import { createTest } from '../../../test/testUtil.js'
vi.mock('../logger.js')
vi.mock('./common.js', () => {
  return {
    initConsumerGroup: vi.fn(),
    consumeGroup: vi.fn(),
    createParser: vi.fn()
  }
})
vi.mock('../fetchStreaming.js', async () => {
  return {
    sendToUser: vi.fn()
  }
})

import * as config from '../../config.js'
import { initConsumerGroup, consumeGroup } from './common.js'
import { message, initMessageConsumerGroup, consumeMessage } from './message.js'
import { sendToUser } from '../fetchStreaming.js'

const test = await createTest(globalThis)

test('initRemoveConsumerGroup', async ({ testRedis }) => {
  const init = vi.mocked(initConsumerGroup)

  await initMessageConsumerGroup(testRedis)

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][1]).toStrictEqual(config.stream.MESSAGE)
})

test('consumeRemove', async ({ testDb, testRedis }) => {
  const consume = vi.mocked(consumeGroup)

  await consumeMessage({ db: testDb, redis: testRedis })

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][3]).toStrictEqual(config.stream.MESSAGE)
})

test('message', async ({ testDb, testRedis }) => {
  const sendToUserMock = vi.mocked(sendToUser)
  sendToUserMock.mockClear()

  const users = ['5cc9d148139370d11b706624', '5cc9d148139370d11b706625']
  const queues = users.map((user) => {
    return JSON.stringify({
      cmd: 'cmd',
      user: user
    })
  })

  await message({
    db: testDb,
    redis: testRedis,
    ackId: 'queue-id',
    messages: ['message', queues[0]]
  })
  await message({
    db: testDb,
    redis: testRedis,
    ackId: 'queue-id',
    messages: ['message', queues[1]]
  })

  expect(sendToUserMock.mock.calls.length).toBe(2)
  expect(sendToUserMock.mock.calls[0][0]).toBe(users[0])
  expect(sendToUserMock.mock.calls[0][1].toString()).toBe(queues[0])
  expect(sendToUserMock.mock.calls[1][0]).toBe(users[1])
  expect(sendToUserMock.mock.calls[1][1].toString()).toBe(queues[1])
})
