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

import { ObjectId } from 'mongodb'
import * as config from '../../config.js'
import { ReplyQueue } from '../../types.js'
import { collections } from '../db.js'
import { type ExRedisClient } from '../redis.js'
import { initConsumerGroup, consumeGroup } from './common.js'
import { reply, initReplyConsumerGroup, consumeReply } from './reply.js'

const test = await createTest(globalThis)

test('initReplyConsumerGroup', async ({ testRedis }) => {
  const init = vi.mocked(initConsumerGroup)

  await initReplyConsumerGroup(testRedis)

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][1]).toStrictEqual(config.stream.REPLY)
})

test('consumeReply', async ({ testDb, testRedis }) => {
  const consume = vi.mocked(consumeGroup)

  await consumeReply({ db: testDb, redis: testRedis })

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][3]).toStrictEqual(config.stream.REPLY)
})

test('reply', async ({ testDb }) => {
  const xack = vi.fn()
  xack.mockClear()
  xack.mockResolvedValue(1)
  const redis = { xack } as unknown as ExRedisClient

  const userId = new ObjectId()
  await collections(testDb).users.insertOne({
    _id: userId,
    account: userId.toHexString(),
    roomOrder: []
  })

  const targetRoomId = new ObjectId()
  const enter = [targetRoomId, new ObjectId(), new ObjectId()].map(
    (roomId) => ({ userId, roomId, unreadCounter: 0, replied: 0 })
  )
  await collections(testDb).enter.insertMany(enter)

  const _replyQueue: ReplyQueue = {
    roomId: targetRoomId.toHexString(),
    userId: userId.toHexString()
  }
  const replyQueue = JSON.stringify(_replyQueue)
  await reply({
    db: testDb,
    redis,
    ackId: 'queue-id',
    messages: ['unread', replyQueue]
  })

  let data = await collections(testDb).enter.find({ userId }).toArray()
  for (const d of data) {
    if (d.roomId.toHexString() === targetRoomId.toHexString()) {
      expect(d.replied).toStrictEqual(1)
    } else {
      expect(d.replied).toStrictEqual(0)
    }
  }
  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')

  // call twice
  await reply({
    db: testDb,
    redis,
    ackId: 'queue-id',
    messages: ['unread', replyQueue]
  })

  data = await collections(testDb).enter.find({ userId }).toArray()
  for (const d of data) {
    if (d.roomId.toHexString() === targetRoomId.toHexString()) {
      expect(d.replied).toStrictEqual(2)
    } else {
      expect(d.replied).toStrictEqual(0)
    }
  }
})
