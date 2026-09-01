import {
  MongoServerError,
  ObjectId,
  type WithId,
  type MongoClient
} from 'mongodb'
import {
  collections,
  RoomStatusEnum,
  type Enter,
  type Room
} from '../lib/db.js'
import { logger } from '../lib/logger.js'
import * as config from '../config.js'

export async function initGeneral({ db }: { db: MongoClient }) {
  await collections(db).rooms.updateOne(
    { name: config.room.GENERAL_ROOM_NAME },
    {
      $set: {
        name: config.room.GENERAL_ROOM_NAME,
        status: RoomStatusEnum.OPEN,
        createdBy: 'system'
      }
    },
    { upsert: true }
  )
}

export function isValidateRoomName(name: string): {
  valid: boolean
  reason?: string
} {
  if (!name.trim()) {
    return { valid: false, reason: 'name is empty' }
  } else if (name.length > config.room.MAX_ROOM_NAME_LENGTH) {
    return { valid: false, reason: `over ${config.room.MAX_ROOM_NAME_LENGTH}` }
  } else if (name.length < config.room.MIN_ROOM_NAME_LENGTH) {
    return { valid: false, reason: `less ${config.room.MAX_ROOM_NAME_LENGTH}` }
  } else if (config.room.BANNED_ROOM_NAME.has(name)) {
    return { valid: false, reason: `${name} is not valid` }
  } else if (
    config.room.BANNED_CHARS_REGEXP_IN_ROOM_NAME.test(name) ||
    config.room.BANNED_UNICODE_REGEXP_IN_ROOM_NAME.test(name)
  ) {
    return { valid: false, reason: 'banned chars' }
  }
  return { valid: true }
}

export async function enterRoom(
  db: MongoClient,
  userId: ObjectId,
  roomId: ObjectId
) {
  const enter: Enter = {
    userId,
    roomId,
    unreadCounter: 0,
    replied: 0
  }

  await Promise.all([
    collections(db).enter.findOneAndUpdate(
      { userId, roomId },
      { $set: enter },
      { upsert: true }
    ),
    collections(db).users.findOneAndUpdate(
      { _id: userId },
      { $addToSet: { roomOrder: roomId.toHexString() } }
    )
  ])
}

export async function createRoom({
  userId,
  name,
  db
}: {
  db: MongoClient
  userId: ObjectId
  name: string
}): Promise<WithId<Room> | null> {
  const createdBy = userId.toHexString()
  const room: Pick<Room, 'name' | 'createdBy' | 'status'> = {
    name,
    createdBy,
    status: RoomStatusEnum.CLOSE
  }

  let insertedId: ObjectId
  try {
    const inserted = await collections(db).rooms.insertOne(room)
    insertedId = inserted.insertedId
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      const existing = await collections(db).rooms.findOne({ name, createdBy })
      if (!existing) {
        return null
      }
      await enterRoom(db, userId, existing._id)
      return existing
    }
    throw error
  }

  await enterRoom(db, userId, insertedId)

  logger.info(
    `[room:create] ${name} (${insertedId.toHexString()}) created by ${createdBy}`
  )
  return { _id: insertedId, ...room }
}
