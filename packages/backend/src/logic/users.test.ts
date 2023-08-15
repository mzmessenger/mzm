import { vi, test, expect, beforeAll } from 'vitest'
vi.mock('../lib/logger.js')
vi.mock('../lib/redis.js', () => {
  return {
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})
vi.mock('../lib/db.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/db.js')>(
    '../lib/db.js'
  )
  return { ...actual, mongoClient: vi.fn() }
})

import { ObjectId } from 'mongodb'
import { getTestMongoClient } from '../../test/testUtil.js'
import * as config from '../config.js'
import {
  collections,
  COLLECTION_NAMES,
  type Enter,
  type Room
} from '../lib/db.js'
import { initGeneral } from './rooms.js'
import { initUser, getAllUserIdsInRoom } from './users.js'

beforeAll(async () => {
  const { mongoClient } = await import('../lib/db.js')
  const { getTestMongoClient } = await import('../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

test('initUser', async () => {
  await initGeneral()

  const userId = new ObjectId()
  const account = 'aaa'

  await initUser(userId, account)

  // user
  const db = await getTestMongoClient(globalThis)
  const foundUser = await collections(db).users.findOne({ _id: userId })
  expect(userId.toHexString()).toStrictEqual(foundUser?._id.toHexString())
  expect(`${account}_${userId.toHexString()}`).toStrictEqual(foundUser?.account)

  // default room
  const foundRooms = await collections(db)
    .enter.aggregate<Enter & { room: Room[] }>([
      {
        $match: { userId: userId }
      },
      {
        $lookup: {
          from: COLLECTION_NAMES.ROOMS,
          localField: 'roomId',
          foreignField: '_id',
          as: 'room'
        }
      }
    ])
    .toArray()

  // general にだけ入室している
  expect(foundRooms.length).toStrictEqual(1)
  expect(foundRooms[0].room[0].name).toStrictEqual(
    config.room.GENERAL_ROOM_NAME
  )
})

test('getAllUserIdsInRoom', async () => {
  const roomId = new ObjectId()
  const users = [new ObjectId(), new ObjectId(), new ObjectId()]
  const userIdStrs = users.map((user) => user.toHexString())
  const enter: Omit<Enter, '_id'>[] = users.map((user) => {
    return {
      roomId: roomId,
      userId: user,
      unreadCounter: 0,
      replied: 0
    }
  })

  const db = await getTestMongoClient(globalThis)
  await collections(db).enter.insertMany(enter)

  const ids = await getAllUserIdsInRoom(roomId.toHexString())

  expect(ids.length).toStrictEqual(users.length)
  for (const id of ids) {
    expect(userIdStrs.includes(id)).toStrictEqual(true)
  }
})
