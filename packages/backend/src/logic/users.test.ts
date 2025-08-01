import { vi, expect } from 'vitest'
vi.mock('../lib/logger.js')
vi.mock('../lib/redis.js', () => {
  return {
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})

import { ObjectId } from 'mongodb'
import { createTest } from '../../test/testUtil.js'
import * as config from '../config.js'
import {
  collections,
  COLLECTION_NAMES,
  type Enter,
  type Room
} from '../lib/db.js'
import { initGeneral } from './rooms.js'
import { initUser, getAllUserIdsInRoom } from './users.js'

const test = await createTest(globalThis)

test('initUser', async ({ testDb, testRedis }) => {
  await initGeneral({ db: testDb, redis: testRedis })

  const userId = new ObjectId()
  const account = 'aaa'

  await initUser(testDb, userId, account)

  // user
  const foundUser = await collections(testDb).users.findOne({ _id: userId })
  expect(userId.toHexString()).toStrictEqual(foundUser?._id.toHexString())
  expect(`${account}_${userId.toHexString()}`).toStrictEqual(foundUser?.account)

  // default room
  const foundRooms = await collections(testDb)
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

test('getAllUserIdsInRoom', async ({ testDb }) => {
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

  await collections(testDb).enter.insertMany(enter)

  const ids = await getAllUserIdsInRoom(testDb, roomId.toHexString())

  expect.assertions(ids.length + 1)
  expect(ids.length).toStrictEqual(users.length)
  for (const id of ids) {
    expect(userIdStrs.includes(id)).toStrictEqual(true)
  }
})
