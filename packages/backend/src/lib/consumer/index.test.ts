import { vi, test, expect } from 'vitest'
vi.mock('./remove.js', () => {
  return {
    initRemoveConsumerGroup: vi.fn(),
    consumeRemove: vi.fn()
  }
})
vi.mock('./unread.js', () => {
  return {
    initUnreadConsumerGroup: vi.fn(),
    consumeUnread: vi.fn()
  }
})
vi.mock('./reply.js', () => {
  return {
    initReplyConsumerGroup: vi.fn(),
    consumeReply: vi.fn()
  }
})
vi.mock('./search/room.js', () => {
  return {
    initSearchRoomConsumerGroup: vi.fn(),
    consumeSearchRooms: vi.fn()
  }
})
vi.mock('./job.js', () => {
  return {
    initJobConsumerGroup: vi.fn(),
    consumeJob: vi.fn()
  }
})
vi.mock('./vote.js', () => {
  return {
    initRenameConsumerGroup: vi.fn(),
    consumeVote: vi.fn()
  }
})
vi.mock('./message.js', () => {
  return {
    initMessageConsumerGroup: vi.fn(),
    consumeMessage: vi.fn()
  }
})

import { initConsumer } from './index.js'
import * as consumerRemove from './remove.js'
import * as consumerUnread from './unread.js'
import * as consumeReply from './reply.js'
import * as consumeSearchRoom from './search/room.js'
import * as consumeJob from './job.js'
import * as consumeVote from './vote.js'
import * as consumeMessage from './message.js'

test('init', async () => {
  const mocks = [
    [consumerRemove.initRemoveConsumerGroup, consumerRemove.consumeRemove],
    [consumerUnread.initUnreadConsumerGroup, consumerUnread.consumeUnread],
    [consumeReply.initReplyConsumerGroup, consumeReply.consumeReply],
    [
      consumeSearchRoom.initSearchRoomConsumerGroup,
      consumeSearchRoom.consumeSearchRooms
    ],
    [consumeJob.initJobConsumerGroup, consumeJob.consumeJob],
    [consumeVote.initRenameConsumerGroup, consumeVote.consumeVote],
    [consumeMessage.initMessageConsumerGroup, consumeMessage.consumeMessage]
  ]

  expect.assertions(mocks.length * 2)

  for (const [init, consume] of mocks) {
    const initMock = vi.mocked(init)
    initMock.mockClear()
    initMock.mockResolvedValue()
    const consumeMock = vi.mocked(consume)
    consumeMock.mockClear()
    consumeMock.mockResolvedValue()
  }

  await initConsumer()

  for (const [init, consume] of mocks) {
    expect(init.call.length).toStrictEqual(1)
    expect(consume.call.length).toStrictEqual(1)
  }
})
