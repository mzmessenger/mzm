/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { vi, test, expect, beforeAll } from 'vitest'
vi.mock('../lib/logger.js')
vi.mock('../lib/redis.js', () => {
  return {
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})
vi.mock('../lib/elasticsearch/index.js', () => {
  return {
    client: {}
  }
})
vi.mock('../lib/db.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/db.js')>(
    '../lib/db.js'
  )
  return { ...actual, mongoClient: vi.fn() }
})

import type { API, RouteParams } from 'mzm-shared/src/type/api'
import { ObjectId, WithId } from 'mongodb'
import { BadRequest } from 'mzm-shared/src/lib/errors'
import { getTestMongoClient, createRequest } from '../../test/testUtil.js'
import * as config from '../config.js'
import { collections, type User, type Enter } from '../lib/db.js'
import { initGeneral } from '../logic/rooms.js'
import { exitRoom, getUsers } from './rooms.js'

beforeAll(async () => {
  const { mongoClient } = await import('../lib/db.js')
  const { getTestMongoClient } = await import('../../test/testUtil.js')
  vi.mocked(mongoClient).mockImplementation(() => {
    return getTestMongoClient(globalThis)
  })
})

test('exitRoom fail (general)', async () => {
  expect.assertions(1)
  await initGeneral()

  const userId = new ObjectId()

  const db = await getTestMongoClient(globalThis)
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
  const req = createRequest<
    API['/api/rooms/enter']['DELETE']['request']['body']
  >(userId, { body })

  try {
    await exitRoom.handler(req)
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test.each([[null, '']])('exitRoom BadRequest (%s)', async (arg) => {
  expect.assertions(1)

  const body:
    | API['/api/rooms/enter']['DELETE']['request']['body']
    | { room: null } = {
    room: arg
  }
  const req = createRequest(new ObjectId(), { body })

  try {
    await exitRoom.handler(req)
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
  const db = await getTestMongoClient(globalThis)
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

  const params = { roomId: roomId.toHexString() }
  let req = createRequest<unknown, RouteParams<'/api/rooms/:roomId/users'>>(
    userId,
    { params }
  )

  let res = await getUsers.handler(req)

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
  res = await getUsers.handler(req)

  expect(res.count).toStrictEqual(config.room.USER_LIMIT + overNum)
  expect(res.users.length).toStrictEqual(overNum)
})
