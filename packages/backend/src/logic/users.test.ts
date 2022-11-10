import type { MongoMemoryServer } from 'mongodb-memory-server'
import { vi, test, expect, beforeAll, afterAll } from 'vitest'
vi.mock('../lib/logger')
vi.mock('../lib/redis', () => {
  return {
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})

import { ObjectId } from 'mongodb'
import { mongoSetup } from '../../test/testUtil'
import * as config from '../config'
import * as db from '../lib/db'
import { initGeneral } from './rooms'
import { initUser, getAllUserIdsInRoom } from './users'

let mongoServer: MongoMemoryServer | null = null

beforeAll(async () => {
  const mongo = await mongoSetup()
  mongoServer = mongo.mongoServer
  await db.connect(mongo.uri)
})

afterAll(async () => {
  await db.close()
  await mongoServer?.stop()
})

test('initUser', async () => {
  await initGeneral()

  const userId = new ObjectId()
  const account = 'aaa'

  await initUser(userId, account)

  // user
  const foundUser = await db.collections.users.findOne({ _id: userId })
  expect(userId.toHexString()).toStrictEqual(foundUser?._id.toHexString())
  expect(`${account}_${userId.toHexString()}`).toStrictEqual(foundUser?.account)

  // default room
  const foundRooms = await db.collections.enter
    .aggregate<db.Enter & { room: db.Room[] }>([
      {
        $match: { userId: userId }
      },
      {
        $lookup: {
          from: db.COLLECTION_NAMES.ROOMS,
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
  const enter: Omit<db.Enter, '_id'>[] = users.map((user) => {
    return {
      roomId: roomId,
      userId: user,
      unreadCounter: 0,
      replied: 0
    }
  })

  await db.collections.enter.insertMany(enter)

  const ids = await getAllUserIdsInRoom(roomId.toHexString())

  expect(ids.length).toStrictEqual(users.length)
  for (const id of ids) {
    expect(userIdStrs.includes(id)).toStrictEqual(true)
  }
})
