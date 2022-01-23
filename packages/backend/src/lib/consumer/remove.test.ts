jest.mock('../logger')
jest.mock('../redis', () => {
  return {
    client: {
      xack: jest.fn()
    }
  }
})
jest.mock('./common', () => {
  return {
    initConsumerGroup: jest.fn(),
    consumeGroup: jest.fn(),
    createParser: jest.fn()
  }
})

import { ObjectId } from 'mongodb'
import * as config from '../../config'
import { mongoSetup, getMockType } from '../../../jest/testUtil'
import * as db from '../db'
import { client } from '../redis'
import { initConsumerGroup, consumeGroup } from './common'
import { remove, initRemoveConsumerGroup, consumeRemove } from './remove'

let mongoServer = null

beforeAll(async () => {
  const mongo = await mongoSetup()
  mongoServer = mongo.mongoServer
  return await db.connect(mongo.uri)
})

afterAll(async () => {
  await db.close()
  await mongoServer.stop()
})

test('initRemoveConsumerGroup', async () => {
  const init = getMockType(initConsumerGroup)

  await initRemoveConsumerGroup()

  expect(init.mock.calls.length).toStrictEqual(1)
  expect(init.mock.calls[0][0]).toStrictEqual(config.stream.REMOVE_USER)
})

test('consumeRemove', async () => {
  const consume = getMockType(consumeGroup)

  await consumeRemove()

  expect(consume.mock.calls.length).toStrictEqual(1)
  expect(consume.mock.calls[0][2]).toStrictEqual(config.stream.REMOVE_USER)
})

test('remove', async () => {
  const xack = getMockType(client.xack)
  xack.mockClear()
  xack.mockResolvedValue('resolve')

  const userId = new ObjectId()
  const roomIds = [new ObjectId(), new ObjectId()]
  await db.collections.users.insertOne({
    _id: userId,
    account: 'test',
    roomOrder: []
  })
  const insert = roomIds.map((roomId) => {
    return { userId, roomId, unreadCounter: 0, replied: 0 }
  })
  await db.collections.enter.insertMany(insert)

  const before = await db.collections.removed.find({ _id: userId }).toArray()
  expect(before.length).toStrictEqual(0)

  await remove('queue-id', ['user', userId.toHexString()])

  const removed = await db.collections.removed
    .find({ originId: userId })
    .toArray()
  expect(removed.length).toStrictEqual(1)
  const roomIdString = roomIds.map((r) => r.toHexString())
  for (const r of removed) {
    expect(r.enter.length).toStrictEqual(roomIds.length)
    for (const e of r.enter) {
      expect(roomIdString.includes(e.toHexString())).toStrictEqual(true)
    }
  }

  const enter = await db.collections.enter.find({ userId }).toArray()
  expect(enter.length).toStrictEqual(0)

  expect(xack.mock.calls.length).toStrictEqual(1)
  expect(xack.mock.calls[0][2]).toStrictEqual('queue-id')
})
