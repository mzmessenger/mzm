import { vi, test, expect, beforeAll, beforeEach } from 'vitest'
vi.mock('../lib/logger.js')
vi.mock('../lib/redis.js', () => {
  return {
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})
vi.mock('../lib/db.js', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/db.js')>('../lib/db.js')
  return { ...actual, mongoClient: vi.fn() }
})

import { ObjectId } from 'mongodb'
import { getTestMongoClient, dropCollection } from '../../test/testUtil.js'
import * as config from '../config.js'
import { collections, RoomStatusEnum, COLLECTION_NAMES } from '../lib/db.js'
import * as redis from '../lib/redis.js'
import { initGeneral, enterRoom, isValidateRoomName } from './rooms.js'

beforeAll(async () => {
  const { mongoClient } = await import('../lib/db.js')
  const { getTestMongoClient } = await import('../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

beforeEach(async () => {
  const db = await getTestMongoClient(globalThis)
  await dropCollection(db, COLLECTION_NAMES.ROOMS)
})

test('initGeneral', async () => {
  const release = vi.mocked(redis.release)
  release.mockClear()

  const db = await getTestMongoClient(globalThis)
  let general = await collections(db)
    .rooms.find({
      name: config.room.GENERAL_ROOM_NAME
    })
    .toArray()

  expect(general.length).toStrictEqual(0)

  await initGeneral()

  general = await collections(db)
    .rooms.find({
      name: config.room.GENERAL_ROOM_NAME
    })
    .toArray()

  expect(general.length).toStrictEqual(1)
  expect(general[0].name).toStrictEqual(config.room.GENERAL_ROOM_NAME)
  expect(general[0].status).toStrictEqual(RoomStatusEnum.OPEN)
  expect(release.mock.calls.length).toStrictEqual(1)

  // 初期化済みのものはupdateされる
  await collections(db).rooms.updateOne(
    { _id: general[0]._id },
    {
      $set: {
        name: config.room.GENERAL_ROOM_NAME,
        status: RoomStatusEnum.CLOSE
      }
    }
  )

  await initGeneral()

  const updated = await collections(db).rooms.findOne({
    _id: general[0]._id
  })
  expect(updated?.name).toStrictEqual(config.room.GENERAL_ROOM_NAME)
  expect(updated?.status).toStrictEqual(RoomStatusEnum.OPEN)
})

test('initGeneral (locked)', async () => {
  const lock = vi.mocked(redis.lock)
  lock.mockClear()
  lock.mockResolvedValue(false)
  const release = vi.mocked(redis.release)
  release.mockClear()

  const db = await getTestMongoClient(globalThis)
  const originUpdate = collections(db).rooms.updateOne
  const updateMock = vi.fn()
  collections(db).rooms.updateOne = updateMock

  await initGeneral()

  expect(updateMock.mock.calls.length).toStrictEqual(0)
  expect(release.mock.calls.length).toStrictEqual(0)

  collections(db).rooms.updateOne = originUpdate
})

test('enterRoom', async () => {
  const roomId = new ObjectId()
  const userId = new ObjectId()

  const db = await getTestMongoClient(globalThis)
  const before = await collections(db)
    .enter.find({
      userId: userId,
      roomId: roomId
    })
    .toArray()

  expect(before.length).toStrictEqual(0)

  await enterRoom(userId, roomId)

  const found = await collections(db)
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
