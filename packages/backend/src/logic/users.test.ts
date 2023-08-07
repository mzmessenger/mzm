import { vi, test, expect } from 'vitest'
vi.mock('../lib/logger')
vi.mock('../lib/redis', () => {
  return {
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})
vi.mock('../lib/db.js', async () => {
  const { mockDb } = await import('../../test/mock.js')
  return { ...(await mockDb(await vi.importActual('../lib/db.js'))) }
})

import { ObjectId } from 'mongodb'
import { getTestMongoClient } from '../../test/testUtil'
import * as config from '../config'
import { collections, COLLECTION_NAMES, type Enter, type Room } from '../lib/db'
import { initGeneral } from './rooms'
import { initUser, getAllUserIdsInRoom } from './users'

test('initUser', async () => {
  await initGeneral()

  const userId = new ObjectId()
  const account = 'aaa'

  await initUser(userId, account)

  // user
  const db = await getTestMongoClient()
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

  const db = await getTestMongoClient()
  await collections(db).enter.insertMany(enter)

  const ids = await getAllUserIdsInRoom(roomId.toHexString())

  expect(ids.length).toStrictEqual(users.length)
  for (const id of ids) {
    expect(userIdStrs.includes(id)).toStrictEqual(true)
  }
})
