import { ObjectId, WithId } from 'mongodb'
import isEmpty from 'validator/lib/isEmpty.js'
import * as db from '../lib/db.js'
import { logger } from '../lib/logger.js'
import { lock, release } from '../lib/redis.js'
import * as config from '../config.js'
import { addUpdateSearchRoomQueue } from '../lib/provider/index.js'

export const initGeneral = async () => {
  const lockKey = config.lock.INIT_GENERAL_ROOM
  const lockVal = new ObjectId().toHexString()
  const locked = await lock(lockKey, lockVal, 1000)

  if (!locked) {
    logger.info('[locked] initGeneral')
    return
  }

  await db.collections.rooms.updateOne(
    {
      name: config.room.GENERAL_ROOM_NAME
    },
    {
      $set: {
        name: config.room.GENERAL_ROOM_NAME,
        status: db.RoomStatusEnum.OPEN,
        createdBy: 'system'
      }
    },
    { upsert: true }
  )

  await release(lockKey, lockVal)
}

export const isValidateRoomName = (
  name: string
): { valid: boolean; reason?: string } => {
  if (isEmpty(name)) {
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

export const enterRoom = async (userId: ObjectId, roomId: ObjectId) => {
  const enter: db.Enter = {
    userId: userId,
    roomId: roomId,
    unreadCounter: 0,
    replied: 0
  }

  await Promise.all([
    db.collections.enter.findOneAndUpdate(
      { userId: userId, roomId: roomId },
      { $set: enter },
      {
        upsert: true
      }
    ),
    db.collections.users.findOneAndUpdate(
      { _id: userId },
      { $addToSet: { roomOrder: roomId.toHexString() } }
    )
  ])
}

export const createRoom = async (
  userId: ObjectId,
  name: string
): Promise<WithId<db.Room>> => {
  const lockKey = config.lock.CREATE_ROOM + ':' + name
  const lockVal = new ObjectId().toHexString()
  const locked = await lock(lockKey, lockVal, 1000)

  if (!locked) {
    logger.info('[locked] createRoom:' + name)
    return
  }

  const createdBy = userId.toHexString()
  const room: Pick<db.Room, 'name' | 'createdBy' | 'status'> = {
    name,
    createdBy,
    status: db.RoomStatusEnum.CLOSE
  }
  const inserted = await db.collections.rooms.insertOne(room)
  await enterRoom(userId, inserted.insertedId)

  const id = inserted.insertedId.toHexString()
  logger.info(`[room:create] ${name} (${id}) created by ${createdBy}`)

  await release(lockKey, lockVal)

  return {
    _id: inserted.insertedId,
    name,
    createdBy,
    updatedBy: null,
    status: db.RoomStatusEnum.CLOSE
  }
}

export const syncSeachAllRooms = async () => {
  let counter = 0
  let roomIds = []

  const cursor = await db.collections.rooms.find({}, { projection: { _id: 1 } })

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
