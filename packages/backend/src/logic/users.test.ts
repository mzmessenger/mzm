jest.mock('../lib/logger')
jest.mock('../lib/redis', () => {
  return {
    lock: jest.fn(() => Promise.resolve(true)),
    release: jest.fn()
  }
})

import { ObjectId } from 'mongodb'
import { mongoSetup } from '../../jest/testUtil'
import * as config from '../config'
import * as db from '../lib/db'
import { initGeneral } from './rooms'
import { isValidAccount, initUser, getAllUserIdsInRoom } from './users'

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

test.each([
  ['valid1234'],
  ['valid_1234'],
  ['a-ho-ge'],
  ['yx-'],
  ['a'.repeat(config.account.MAX_LENGTH)]
])('isValidAccount success (%s)', (arg: string) => {
  const isValid = isValidAccount(arg)
  expect(isValid).toStrictEqual(true)
})

test.each([
  ['  aaaa'],
  ['test test'],
  ['a@hoge'],
  ['&amp;aa%&gt;&lt;'],
  ['@hoge'],
  ['insert'],
  ['update'],
  ['find'],
  ['remove'],
  ['removed'],
  ['X-'],
  ['x-'],
  ['here'],
  ['online'],
  ['all'],
  ['channel'],
  ['a'],
  ['a'.repeat(config.account.MAX_LENGTH + 1)]
])('isValidAccount fail (%s)', (arg: string) => {
  const isValid = isValidAccount(arg)
  expect(isValid).toStrictEqual(false)
})

test('initUser', async () => {
  await initGeneral()

  const userId = new ObjectId()
  const account = 'aaa'

  await initUser(userId, account)

  // user
  const foundUser = await db.collections.users.findOne({ _id: userId })
  expect(userId.toHexString()).toStrictEqual(foundUser._id.toHexString())
  expect(account).toStrictEqual(foundUser.account)

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
