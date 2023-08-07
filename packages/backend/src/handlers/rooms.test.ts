/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { vi, test, expect } from 'vitest'
vi.mock('../lib/logger')
vi.mock('../lib/redis', () => {
  return {
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})
vi.mock('../lib/elasticsearch/index', () => {
  return {
    client: {}
  }
})
vi.mock('../lib/db.js', async () => {
  const { mockDb } = await import('../../test/mock.js')
  return { ...(await mockDb(await vi.importActual('../lib/db.js'))) }
})

import { ObjectId, WithId } from 'mongodb'
import { getTestMongoClient, createRequest } from '../../test/testUtil'
import * as config from '../config'
import { collections, type User, type Enter } from '../lib/db'
import { initGeneral } from '../logic/rooms'
import { BadRequest } from 'mzm-shared/lib/errors'
import { exitRoom, getUsers } from './rooms'

const db = await getTestMongoClient()

test('exitRoom fail (general)', async () => {
  expect.assertions(1)
  await initGeneral()

  const userId = new ObjectId()

  const general = await collections(db).rooms.findOne({
    name: config.room.GENERAL_ROOM_NAME
  })

  await collections(db).enter.insertOne({
    userId: userId,
    roomId: general!._id,
    unreadCounter: 0,
    replied: 0
  })

  const body = { room: general!._id.toHexString() }
  const req = createRequest(userId, { body })

  try {
    await exitRoom(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test.each([[null, '']])('exitRoom BadRequest (%s)', async (arg) => {
  expect.assertions(1)

  const body = { room: arg }
  const req = createRequest(new ObjectId(), { body })

  try {
    await exitRoom(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('getUsers', async () => {
  const userId = new ObjectId()
  const roomId = new ObjectId()

  const overNum = 4

  const users: WithId<User>[] = []
  const insert: Omit<Enter, '_id'>[] = []
  for (let i = 0; i < config.room.USER_LIMIT + overNum; i++) {
    const userId = new ObjectId()
    const user: WithId<User> = {
      _id: userId,
      account: userId.toHexString(),
      roomOrder: []
    }
    const enter: Omit<Enter, '_id'> = {
      roomId,
      userId,
      unreadCounter: 0,
      replied: 0
    }
    insert.push(enter)
    // 削除済みユーザーのテストのため歯抜けにする
    if (i % 2 === 0) {
      users.push(user)
    }
  }
  await Promise.all([
    collections(db).enter.insertMany(insert),
    collections(db).users.insertMany(users)
  ])

  const userIds = users.map((u) => u._id)
  const userMap = (
    await collections(db)
      .users.find({ _id: { $in: userIds } })
      .toArray()
  ).reduce((map, current) => {
    map.set(current._id.toHexString(), current)
    return map
  }, new Map<string, WithId<User>>())

  const params = { roomid: roomId.toHexString() }
  let req = createRequest(userId, { params })

  let res = await getUsers(req)

  expect(res.count).toStrictEqual(config.room.USER_LIMIT + overNum)
  expect(res.users.length).toStrictEqual(config.room.USER_LIMIT)

  for (const user of res.users) {
    const dbUser = userMap.get(user.userId)
    if (dbUser) {
      expect(user.userId).toStrictEqual(dbUser._id.toHexString())
      expect(user.account).toStrictEqual(dbUser.account)
    } else {
      expect(user.account).toStrictEqual('removed')
    }
  }

  // threshold
  const query = { threshold: res.users[res.users.length - 1].enterId }
  req = createRequest(userId, { params, query })
  res = await getUsers(req)

  expect(res.count).toStrictEqual(config.room.USER_LIMIT + overNum)
  expect(res.users.length).toStrictEqual(overNum)
})
