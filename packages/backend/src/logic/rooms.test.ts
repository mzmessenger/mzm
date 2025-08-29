import { vi, expect, beforeEach } from 'vitest'
vi.mock('../lib/logger.js')
vi.mock('../lib/redis.js', () => {
  return {
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})

import { ObjectId } from 'mongodb'
import {
  createTest,
  getTestMongoClient,
  dropCollection
} from '../../test/testUtil.js'
import * as config from '../config.js'
import { collections, RoomStatusEnum, COLLECTION_NAMES } from '../lib/db.js'
import * as redis from '../lib/redis.js'
import { initGeneral, enterRoom, isValidateRoomName } from './rooms.js'

const test = await createTest(globalThis)

beforeEach(async () => {
  const db = await getTestMongoClient(globalThis)
  await dropCollection(db, COLLECTION_NAMES.ROOMS)
})

test('initGeneral', async ({ testDb, testRedis }) => {
  const release = vi.mocked(redis.release)
  release.mockClear()

  let general = await collections(testDb)
    .rooms.find({
      name: config.room.GENERAL_ROOM_NAME
    })
    .toArray()

  expect(general.length).toStrictEqual(0)

  await initGeneral({ db: testDb, redis: testRedis })

  general = await collections(testDb)
    .rooms.find({
      name: config.room.GENERAL_ROOM_NAME
    })
    .toArray()

  expect(general.length).toStrictEqual(1)
  expect(general[0].name).toStrictEqual(config.room.GENERAL_ROOM_NAME)
  expect(general[0].status).toStrictEqual(RoomStatusEnum.OPEN)
  expect(release.mock.calls.length).toStrictEqual(1)

  // 初期化済みのものはupdateされる
  await collections(testDb).rooms.updateOne(
    { _id: general[0]._id },
    {
      $set: {
        name: config.room.GENERAL_ROOM_NAME,
        status: RoomStatusEnum.CLOSE
      }
    }
  )

  await initGeneral({ db: testDb, redis: testRedis })

  const updated = await collections(testDb).rooms.findOne({
    _id: general[0]._id
  })
  expect(updated?.name).toStrictEqual(config.room.GENERAL_ROOM_NAME)
  expect(updated?.status).toStrictEqual(RoomStatusEnum.OPEN)
})

test('initGeneral (locked)', async ({ testDb, testRedis }) => {
  const lock = vi.mocked(redis.lock)
  lock.mockClear()
  lock.mockResolvedValue(false)
  const release = vi.mocked(redis.release)
  release.mockClear()

  const originUpdate = collections(testDb).rooms.updateOne
  const updateMock = vi.fn()
  collections(testDb).rooms.updateOne = updateMock

  await initGeneral({ db: testDb, redis: testRedis })

  expect(updateMock.mock.calls.length).toStrictEqual(0)
  expect(release.mock.calls.length).toStrictEqual(0)

  collections(testDb).rooms.updateOne = originUpdate
})

test('enterRoom', async ({ testDb }) => {
  const roomId = new ObjectId()
  const userId = new ObjectId()

  const before = await collections(testDb)
    .enter.find({
      userId: userId,
      roomId: roomId
    })
    .toArray()

  expect(before.length).toStrictEqual(0)

  await enterRoom(testDb, userId, roomId)

  const found = await collections(testDb)
    .enter.find({
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

test.for([['aaa'], ['日本語'], ['🍣']])(
  'isValidateRoomName (%s, %s)',
  async ([name]) => {
    const valid = isValidateRoomName(name)
    expect(valid.valid).toStrictEqual(true)
  }
)

test.for([
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
])('isValidateRoomName fail (%s)', async ([, name]) => {
  const valid = isValidateRoomName(name)
  expect(valid.valid).toStrictEqual(false)
})
