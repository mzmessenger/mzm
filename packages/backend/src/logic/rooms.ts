import { ObjectId, type WithId, type MongoClient } from 'mongodb'
import {
  collections,
  RoomStatusEnum,
  type Enter,
  type Room
} from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { lock, release } from '../lib/redis.js'
import * as config from '../config.js'
import { addUpdateSearchRoomQueue } from '../lib/provider/index.js'

export async function initGeneral(db: MongoClient) {
  const lockKey = config.lock.INIT_GENERAL_ROOM
  const lockVal = new ObjectId().toHexString()
  const locked = await lock(lockKey, lockVal, 1000)

  if (!locked) {
    logger.info('[locked] initGeneral')
    return
  }

  await collections(db).rooms.updateOne(
    {
      name: config.room.GENERAL_ROOM_NAME
    },
    {
      $set: {
        name: config.room.GENERAL_ROOM_NAME,
        status: RoomStatusEnum.OPEN,
        createdBy: 'system'
      }
    },
    { upsert: true }
  )

  await release(lockKey, lockVal)
}

export function isValidateRoomName(
  name: string
): { valid: boolean; reason?: string } {
  if (!name.trim()) {
    return { valid: false, reason: 'name is empty' }
  } else if (name.length > config.room.MAX_ROOM_NAME_LENGTH) {
    return {
      valid: false,
      reason: `over ${config.room.MAX_ROOM_NAME_LENGTH}`
    }
  } else if (name.length < config.room.MIN_ROOM_NAME_LENGTH) {
    return {
      valid: false,
      reason: `less ${config.room.MAX_ROOM_NAME_LENGTH}`
    }
  } else if (config.room.BANNED_ROOM_NAME.has(name)) {
    return {
      valid: false,
      reason: `${name} is not valid`
    }
  } else if (
    config.room.BANNED_CHARS_REGEXP_IN_ROOM_NAME.test(name) ||
    config.room.BANNED_UNICODE_REGEXP_IN_ROOM_NAME.test(name)
  ) {
    return {
      valid: false,
      reason: `banned chars`
    }
  }
  return { valid: true }
}

export async function enterRoom(db: MongoClient, userId: ObjectId, roomId: ObjectId) {
  const enter: Enter = {
    userId: userId,
    roomId: roomId,
    unreadCounter: 0,
    replied: 0
  }

  await Promise.all([
    collections(db).enter.findOneAndUpdate(
      { userId: userId, roomId: roomId },
      { $set: enter },
      {
        upsert: true
      }
    ),
    collections(db).users.findOneAndUpdate(
      { _id: userId },
      { $addToSet: { roomOrder: roomId.toHexString() } }
    )
  ])
}

export async function createRoom(
  db: MongoClient,
  userId: ObjectId,
  name: string
): Promise<WithId<Room> | null> {
  const lockKey = config.lock.CREATE_ROOM + ':' + name
  const lockVal = new ObjectId().toHexString()
  const locked = await lock(lockKey, lockVal, 1000)

  if (!locked) {
    logger.info('[locked] createRoom:' + name)
    return null
  }

  const createdBy = userId.toHexString()
  const room: Pick<Room, 'name' | 'createdBy' | 'status'> = {
    name,
    createdBy,
    status: RoomStatusEnum.CLOSE
  }

  const inserted = await collections(db).rooms.insertOne(room)
  await enterRoom(db, userId, inserted.insertedId)

  const id = inserted.insertedId.toHexString()
  logger.info(`[room:create] ${name} (${id}) created by ${createdBy}`)

  await release(lockKey, lockVal)

  return {
    _id: inserted.insertedId,
    name,
    createdBy,
    updatedBy: undefined,
    status: RoomStatusEnum.CLOSE
  }
}

export async function syncSeachAllRooms(db: MongoClient) {
  let counter = 0
  let roomIds: string[] = []

  const cursor = await collections(db).rooms.find(
    {},
    { projection: { _id: 1 } }
  )

  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    roomIds.push(doc._id.toHexString())
    counter++
    if (roomIds.length > 100) {
      await addUpdateSearchRoomQueue(roomIds)
      roomIds = []
    }
  }

  await addUpdateSearchRoomQueue(roomIds)
  logger.info(`[syncSeachAllRooms] ${counter}`)
}
