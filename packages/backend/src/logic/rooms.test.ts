jest.mock('../lib/logger')
jest.mock('../lib/redis', () => {
  return {
    lock: jest.fn(() => Promise.resolve(true)),
    release: jest.fn()
  }
})

import { ObjectId } from 'mongodb'
import { mongoSetup, getMockType } from '../../jest/testUtil'
import * as config from '../config'
import * as db from '../lib/db'
import * as redis from '../lib/redis'
import { initGeneral, enterRoom, isValidateRoomName } from './rooms'

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

test('initGeneral', async () => {
  const release = getMockType(redis.release)
  release.mockClear()

  let general = await db.collections.rooms
    .find({
      name: config.room.GENERAL_ROOM_NAME
    })
    .toArray()

  expect(general.length).toStrictEqual(0)

  await initGeneral()

  general = await db.collections.rooms
    .find({
      name: config.room.GENERAL_ROOM_NAME
    })
    .toArray()

  expect(general.length).toStrictEqual(1)
  expect(general[0].name).toStrictEqual(config.room.GENERAL_ROOM_NAME)
  expect(general[0].status).toStrictEqual(db.RoomStatusEnum.OPEN)
  expect(release.mock.calls.length).toStrictEqual(1)

  // 初期化済みのものはupdateされる
  await db.collections.rooms.updateOne(
    { _id: general[0]._id },
    {
      $set: {
        name: config.room.GENERAL_ROOM_NAME,
        status: db.RoomStatusEnum.CLOSE
      }
    }
  )

  await initGeneral()

  const updated = await db.collections.rooms.findOne({
    _id: general[0]._id
  })
  expect(updated.name).toStrictEqual(config.room.GENERAL_ROOM_NAME)
  expect(updated.status).toStrictEqual(db.RoomStatusEnum.OPEN)
})

test('initGeneral (locked)', async () => {
  const lock = getMockType(redis.lock)
  lock.mockClear()
  lock.mockResolvedValue(false)
  const release = getMockType(redis.release)
  release.mockClear()

  const originUpdate = db.collections.rooms.updateOne
  const updateMock = jest.fn()
  db.collections.rooms.updateOne = updateMock

  await initGeneral()

  expect(updateMock.mock.calls.length).toStrictEqual(0)
  expect(release.mock.calls.length).toStrictEqual(0)

  db.collections.rooms.updateOne = originUpdate
})

test('enterRoom', async () => {
  const roomId = new ObjectId()
  const userId = new ObjectId()

  const before = await db.collections.enter
    .find({
      userId: userId,
      roomId: roomId
    })
    .toArray()

  expect(before.length).toStrictEqual(0)

  await enterRoom(userId, roomId)

  const found = await db.collections.enter
    .find({
      userId: userId,
      roomId: roomId
    })
    .toArray()

  expect(found.length).toStrictEqual(1)
  expect(found[0].roomId.toHexString()).toStrictEqual(roomId.toHexString())
  expect(found[0].userId.toHexString()).toStrictEqual(userId.toHexString())
  expect(found[0].unreadCounter).toStrictEqual(0)
  expect(found[0].replied).toStrictEqual(0)
})

test.each([['aaa'], ['日本語'], ['🍣']])(
  'isValidateRoomName (%s, %s)',
  async (name) => {
    const valid = isValidateRoomName(name)
    expect(valid.valid).toStrictEqual(true)
  }
)

test.each([
  ['slash', '/hoge/fuga'],
  ['back slash', 't\\t'],
  ['space', 'aaa bbb'],
  ['max length', 'a'.repeat(81)],
  ['min length', ''],
  ['start with @', '@foo'],
  ['&', '&room'],
  ['?', '?room'],
  ['=', '=room'],
  ['00A0', '\u00A0'],
  ['2001', ' '],
  ['2003', ' '],
  ['200C', '‌'],
  ['0323', '『̣'],
  ['200B', '​'],
  ['2029', '\u2029'],
  ['202A', '‪'],
  ['undefined', 'undefined'],
  ['null', 'null']
])('isValidateRoomName fail (%s)', async (_label, name) => {
  const valid = isValidateRoomName(name)
  expect(valid.valid).toStrictEqual(false)
})
