/* eslint-disable no-empty-pattern */
import { vi, test as baseTest, expect } from 'vitest'
import { getTestMongoClient } from '../../../test/testUtil.js'
vi.mock('../logger.js')
vi.mock('../redis.js', () => {
  return {
    client: vi.fn(() => ({
      xack: vi.fn()
    }))
  }
})
vi.mock('./common.js', () => {
  return {
    initConsumerGroup: vi.fn(),
    consumeGroup: vi.fn(),
    createParser: vi.fn()
  }
})
vi.mock('../db.js', async () => {
  const actual = await vi.importActual<typeof import('../db.js')>('../db.js')
  return { ...actual, mongoClient: vi.fn() }
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

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

test('initRemoveConsumerGroup', async () => {
  const init = vi.mocked(initConsumerGroup)

  await initMessageConsumerGroup()

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][0]).toStrictEqual(config.stream.MESSAGE)
})

test('consumeRemove', async ({ testDb }) => {
  const consume = vi.mocked(consumeGroup)

  await consumeMessage(testDb)

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][2]).toStrictEqual(config.stream.MESSAGE)
})

test('message', async ({ testDb }) => {
  const sendToUserMock = vi.mocked(sendToUser)
  sendToUserMock.mockClear()

  const users = ['5cc9d148139370d11b706624', '5cc9d148139370d11b706625']
  const queues = users.map((user) => {
    return JSON.stringify({
      cmd: 'cmd',
      user: user
    })
  })

  await message(testDb, 'queue-id', ['message', queues[0]])
  await message(testDb, 'queue-id', ['message', queues[1]])

  expect(sendToUserMock.mock.calls.length).toBe(2)
  expect(sendToUserMock.mock.calls[0][0]).toBe(users[0])
  expect(sendToUserMock.mock.calls[0][1].toString()).toBe(queues[0])
  expect(sendToUserMock.mock.calls[1][0]).toBe(users[1])
  expect(sendToUserMock.mock.calls[1][1].toString()).toBe(queues[1])
})
