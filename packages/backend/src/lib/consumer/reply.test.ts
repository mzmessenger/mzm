import { vi, test, expect } from 'vitest'
vi.mock('../logger')
vi.mock('../redis', () => {
  return {
    client: vi.fn(() => ({
      xack: vi.fn()
    }))
  }
})
vi.mock('./common', () => {
  return {
    initConsumerGroup: vi.fn(),
    consumeGroup: vi.fn(),
    createParser: vi.fn()
  }
})
vi.mock('../db.js', async () => {
  const { mockDb } = await import('../../../test/mock.js')
  return { ...(await mockDb(await vi.importActual('../db.js'))) }
})

import { ObjectId } from 'mongodb'
import * as config from '../../config'
import { createXackMock, getTestMongoClient } from '../../../test/testUtil'
import { ReplyQueue } from '../../types'
import { collections } from '../db'
import { client } from '../redis'
import { initConsumerGroup, consumeGroup } from './common'
import { reply, initReplyConsumerGroup, consumeReply } from './reply'

const db = await getTestMongoClient()

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
  const xack = createXackMock(client)
  xack.mockClear()
  xack.mockResolvedValue(1)

  const userId = new ObjectId()
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
