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
import { collections } from '../db'
import { client } from '../redis'
import { initConsumerGroup, consumeGroup } from './common'
import { remove, initRemoveConsumerGroup, consumeRemove } from './remove'

const db = await getTestMongoClient()

test('initRemoveConsumerGroup', async () => {
  const init = vi.mocked(initConsumerGroup)

  await initRemoveConsumerGroup()

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][0]).toStrictEqual(config.stream.REMOVE_USER)
})

test('consumeRemove', async () => {
  const consume = vi.mocked(consumeGroup)

  await consumeRemove()

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][2]).toStrictEqual(config.stream.REMOVE_USER)
})

test('remove', async () => {
  const xack = createXackMock(client)
  xack.mockClear()
  xack.mockResolvedValue(1)

  const userId = new ObjectId()
  const roomIds = [new ObjectId(), new ObjectId()]
  await collections(db).users.insertOne({
    _id: userId,
    account: 'test',
    roomOrder: []
  })
  const insert = roomIds.map((roomId) => {
    return { userId, roomId, unreadCounter: 0, replied: 0 }
  })
  await collections(db).enter.insertMany(insert)

  const before = await collections(db).removed.find({ _id: userId }).toArray()
  expect(before.length).toStrictEqual(0)

  await remove('queue-id', ['user', userId.toHexString()])

  const removed = await collections(db)
    .removed.find({ originId: userId })
    .toArray()
  expect(removed.length).toStrictEqual(1)
  const roomIdString = roomIds.map((r) => r.toHexString())
  for (const r of removed) {
    expect(r.enter.length).toStrictEqual(roomIds.length)
    for (const e of r.enter) {
      expect(roomIdString.includes(e.toHexString())).toStrictEqual(true)
    }
  }

  const enter = await collections(db).enter.find({ userId }).toArray()
  expect(enter.length).toStrictEqual(0)

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
})
