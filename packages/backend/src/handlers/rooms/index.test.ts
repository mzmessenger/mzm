import { vi, expect } from 'vitest'
import { createTest } from '../../../test/testUtil.js'
vi.mock('../../lib/logger.js')
vi.mock('../../lib/redis.js', () => {
  return {
    lock: vi.fn(() => Promise.resolve(true)),
    release: vi.fn()
  }
})
vi.mock('../../lib/elasticsearch/index.js', () => {
  return {
    client: {}
  }
})

import type { API } from 'mzm-shared/src/api/universal'
import { ObjectId, WithId } from 'mongodb'
import { BadRequest } from 'mzm-shared/src/lib/errors'
import * as config from '../../config.js'
import { collections, type User, type Enter } from '../../lib/db.js'
import { initGeneral } from '../../logic/rooms.js'
import { exitRoom, getUsers } from './index.js'

const test = await createTest(globalThis)

test('exitRoom fail (general)', async ({ testDb, testRedis }) => {
  await initGeneral({ db: testDb, redis: testRedis })

  const userId = new ObjectId()

  const general = await collections(testDb).rooms.findOne({
    name: config.room.GENERAL_ROOM_NAME
  })

  await collections(testDb).enter.insertOne({
    userId: userId,
    roomId: general!._id,
    unreadCounter: 0,
    replied: 0
  })

  const body = { room: general!._id.toHexString() }

  try {
    await exitRoom(testDb, { userId, body })
    expect.unreachable('Should not pass build')
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test.for([null, ''])('exitRoom BadRequest (%s)', async (arg, { testDb }) => {
  const body:
    | API['/api/rooms/enter']['DELETE']['request']['body']
    | { room: null } = {
    room: arg
  }

  try {
    await exitRoom(testDb, { userId: new ObjectId(), body: body as unknown })
    expect.unreachable('Should not pass build')
  } catch (e) {
    expect(e instanceof BadRequest).toStrictEqual(true)
  }
})

test('getUsers', async ({ testDb }) => {
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
    collections(testDb).enter.insertMany(insert),
    collections(testDb).users.insertMany(users)
  ])

  const userIds = users.map((u) => u._id)
  const userMap = (
    await collections(testDb)
      .users.find({ _id: { $in: userIds } })
      .toArray()
  ).reduce((map, current) => {
    map.set(current._id.toHexString(), current)
    return map
  }, new Map<string, WithId<User>>())

  const params = { roomId: roomId.toHexString() }

  let res = await getUsers(testDb, { params, query: {} })

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
  res = await getUsers(testDb, { params, query })

  expect(res.count).toStrictEqual(config.room.USER_LIMIT + overNum)
  expect(res.users.length).toStrictEqual(overNum)
})
