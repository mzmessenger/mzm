import { vi, expect, beforeEach } from 'vitest'
vi.mock('../lib/logger.js')

import { ObjectId } from 'mongodb'
import {
  createTest,
  getTestMongoClient,
  dropCollection
} from '../../test/testUtil.js'
import * as config from '../config.js'
import { collections, RoomStatusEnum, COLLECTION_NAMES } from '../lib/db.js'

import {
  createRoom,
  initGeneral,
  enterRoom,
  isValidateRoomName
} from './rooms.js'

const test = await createTest(globalThis)

beforeEach(async () => {
  const db = await getTestMongoClient(globalThis)
  await dropCollection(db, COLLECTION_NAMES.ROOMS)
})

test('initGeneral', async ({ testDb }) => {
  let general = await collections(testDb)
    .rooms.find({
      name: config.room.GENERAL_ROOM_NAME
    })
    .toArray()

  expect(general.length).toStrictEqual(0)

  await initGeneral({ db: testDb })

  general = await collections(testDb)
    .rooms.find({
      name: config.room.GENERAL_ROOM_NAME
    })
    .toArray()

  expect(general.length).toStrictEqual(1)
  expect(general[0].name).toStrictEqual(config.room.GENERAL_ROOM_NAME)
  expect(general[0].status).toStrictEqual(RoomStatusEnum.OPEN)

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

  await initGeneral({ db: testDb })

  const updated = await collections(testDb).rooms.findOne({
    _id: general[0]._id
  })
  expect(updated?.name).toStrictEqual(config.room.GENERAL_ROOM_NAME)
  expect(updated?.status).toStrictEqual(RoomStatusEnum.OPEN)
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

test('同じ作成者の再試行ではroom参加状態を修復する', async ({ testDb }) => {
  await collections(testDb).rooms.createIndex({ name: 1 }, { unique: true })
  const userId = new ObjectId()
  const created = await createRoom({
    db: testDb,
    userId,
    name: 'retry-room'
  })
  if (!created) {
    throw new Error('room was not created')
  }
  await collections(testDb).enter.deleteMany({ userId })

  const retried = await createRoom({
    db: testDb,
    userId,
    name: 'retry-room'
  })

  expect(retried?._id).toStrictEqual(created._id)
  expect(
    await collections(testDb).enter.findOne({ userId, roomId: created._id })
  ).not.toBeNull()
})

test('同名roomの競合作成では後続userを既存roomへ参加させない', async ({
  testDb
}) => {
  await collections(testDb).rooms.createIndex({ name: 1 }, { unique: true })
  const firstUserId = new ObjectId()
  const secondUserId = new ObjectId()

  const first = await createRoom({
    db: testDb,
    userId: firstUserId,
    name: 'unique-room'
  })
  const second = await createRoom({
    db: testDb,
    userId: secondUserId,
    name: 'unique-room'
  })

  expect(first).not.toBeNull()
  expect(second).toBeNull()
  expect(
    await collections(testDb).enter.findOne({
      userId: secondUserId,
      roomId: first?._id
    })
  ).toBeNull()
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
