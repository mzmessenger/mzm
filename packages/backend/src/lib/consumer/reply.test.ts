/* eslint-disable @typescript-eslint/ban-ts-comment */
import { vi, test, expect, beforeAll } from 'vitest'
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

import { ObjectId } from 'mongodb'
import * as config from '../../config.js'
import { getTestMongoClient } from '../../../test/testUtil.js'
import { ReplyQueue } from '../../types.js'
import { collections } from '../db.js'
import { client } from '../redis.js'
import { initConsumerGroup, consumeGroup } from './common.js'
import { reply, initReplyConsumerGroup, consumeReply } from './reply.js'

beforeAll(async () => {
  const { mongoClient } = await import('../db.js')
  const { getTestMongoClient } = await import('../../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

test('initReplyConsumerGroup', async () => {
  const init = vi.mocked(initConsumerGroup)

  await initReplyConsumerGroup()

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][0]).toStrictEqual(config.stream.REPLY)
})

test('consumeReply', async () => {
  const consume = vi.mocked(consumeGroup)

  await consumeReply()

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][2]).toStrictEqual(config.stream.REPLY)
})

test('reply', async () => {
  const xack = vi.fn()
  // @ts-expect-error
  vi.mocked(client).mockImplementation(() => ({ xack }))
  xack.mockClear()
  xack.mockResolvedValue(1)

  const userId = new ObjectId()
  const db = await getTestMongoClient(globalThis)
  await collections(db).users.insertOne({
    _id: userId,
    account: userId.toHexString(),
    roomOrder: []
  })

  const targetRoomId = new ObjectId()
  const enter = [targetRoomId, new ObjectId(), new ObjectId()].map(
    (roomId) => ({ userId, roomId, unreadCounter: 0, replied: 0 })
  )
  await collections(db).enter.insertMany(enter)

  const _replyQueue: ReplyQueue = {
    roomId: targetRoomId.toHexString(),
    userId: userId.toHexString()
  }
  const replyQueue = JSON.stringify(_replyQueue)
  await reply('queue-id', ['unread', replyQueue])

  let data = await collections(db).enter.find({ userId }).toArray()
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
  await reply('queue-id', ['unread', replyQueue])

  data = await collections(db).enter.find({ userId }).toArray()
  for (const d of data) {
    if (d.roomId.toHexString() === targetRoomId.toHexString()) {
      expect(d.replied).toStrictEqual(2)
    } else {
      expect(d.replied).toStrictEqual(0)
    }
  }
})
