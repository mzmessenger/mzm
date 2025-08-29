import { vi, expect } from 'vitest'
import { createTest, dropCollection } from '../../../test/testUtil.js'
import { RoomStatusEnum } from 'mzm-shared/src/type/db'
vi.mock('../lib/logger.js')

import { ObjectId } from 'mongodb'
import { collections } from '../../lib/db.js'
import { listRooms } from './listRooms.js'

// room.LIST_LIMITをモック
vi.mock('../../config.js', async () => {
  const actual = await vi.importActual<typeof import('../../config.js')>('../../config.js')
  return {
    ...actual,
    room: {
      ...actual.room,
      LIST_LIMIT: 10
    }
  }
})

const test = await createTest(globalThis)

test('listRooms fail (general)', async ({ task, testDb }) => {
  const userId = new ObjectId()
  const prefix = task.id

  const createdRooms = await collections(testDb).rooms.insertMany([
    {
      name: `${prefix}_room1`,
      description: 'room 1',
      createdBy: new ObjectId().toHexString(),
      status: RoomStatusEnum.OPEN
    },
    {
      name: `${prefix}_room2`,
      description: 'room 2',
      createdBy: new ObjectId().toHexString(),
      status: RoomStatusEnum.OPEN
    },
    {
      name: `${prefix}_room3`,
      description: 'room 3',
      createdBy: new ObjectId().toHexString(),
      status: RoomStatusEnum.CLOSE
    },
    {
      name: `${prefix}_room4`,
      description: 'room 4',
      createdBy: new ObjectId().toHexString(),
      status: RoomStatusEnum.CLOSE
    }
  ])
  const { 0: roomId1, 2: roomId3 } = createdRooms.insertedIds

  await collections(testDb).enter.insertMany([
    {
      userId: userId,
      roomId: roomId1,
      unreadCounter: 0,
      replied: 0
    },
    {
      userId: userId,
      roomId: roomId3,
      unreadCounter: 0,
      replied: 0
    },
    {
      userId: new ObjectId(),
      roomId: roomId3,
      unreadCounter: 0,
      replied: 0
    }
  ])

  const { rooms, total } = await listRooms({
    db: testDb,
    userId,
    threshold: null
  })

  expect(rooms).toHaveLength(3)
  expect(total).toBe(3)
})

test('listRooms with threshold and limit', async ({ task, testDb }) => {
  const userId = new ObjectId()
  const prefix = task.id

  await Promise.all([
    dropCollection(testDb, 'enter'),
    dropCollection(testDb, 'rooms')
  ])

  const seeds = Array.from({ length: 15 }, (_, i) => ({
    name: `${prefix}_room${i + 1}`,
    description: `room ${i + 1}`,
    createdBy: new ObjectId().toHexString(),
    status: RoomStatusEnum.OPEN
  }))
  await collections(testDb).rooms.insertMany(seeds)

  // 最初のクエリ（thresholdなし）
  const { rooms: first, total } = await listRooms({
    db: testDb,
    userId,
    threshold: null
  })

  expect(first).toHaveLength(10)
  expect(total).toBe(15)

  const lastRoomId = first[first.length - 1]?.id
  expect(lastRoomId).toBeDefined()

  const { rooms: second } = await listRooms({
    db: testDb,
    userId,
    threshold: lastRoomId
  })

  expect(second).toHaveLength(5)
  
  const firstIds = new Set(first.map(room => room.id))
  const secondIds = new Set(second.map(room => room.id))
  const intersection = firstIds.intersection(secondIds)
  expect(intersection.size).toBe(0)
  expect(first.length + second.length).toBe(15)
})