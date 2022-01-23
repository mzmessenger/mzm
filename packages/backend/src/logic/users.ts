import { ObjectId, WithId } from 'mongodb'
import isEmpty from 'validator/lib/isEmpty'
import * as config from '../config'
import { Room as SendRoom } from '../types'
import { logger } from '../lib/logger'
import * as db from '../lib/db'
import { createRoomIconPath } from '../lib/utils'
import { enterRoom } from './rooms'

export const isValidAccount = (account: string): boolean => {
  if (
    isEmpty(account, { ignore_whitespace: true }) ||
    /.*(insert|update|find|remove).*/.test(account) ||
    /^(here|all|online|channel)$/.test(account) ||
    /^(X|x)-/.test(account)
  ) {
    return false
  } else if (
    account.length < config.account.MIN_LENGTH ||
    account.length > config.account.MAX_LENGTH
  ) {
    return false
  }
  return /^[a-zA-Z\d_-]+$/.test(account)
}

const enterGeneral = async (userId: ObjectId) => {
  const general = await db.collections.rooms.findOne({
    name: config.room.GENERAL_ROOM_NAME
  })
  const existGeneral = await db.collections.enter.findOne({
    userId: userId,
    roomId: general._id
  })
  if (!existGeneral) {
    await enterRoom(userId, general._id)
  }
}

export const initUser = async (userId: ObjectId, account: string) => {
  const [user] = await Promise.all([
    db.collections.users.insertOne({
      _id: userId,
      account: account,
      roomOrder: []
    }),
    enterGeneral(userId)
  ])
  logger.info('[logic/user] initUser', userId, account)
  return user
}

export const getRooms = async (userId: string): Promise<SendRoom[]> => {
  type AggregateType = WithId<db.Enter> & { room: WithId<db.Room>[] }

  const cursor = await db.collections.enter.aggregate<AggregateType>([
    { $match: { userId: new ObjectId(userId) } },
    {
      $lookup: {
        from: db.COLLECTION_NAMES.ROOMS,
        localField: 'roomId',
        foreignField: '_id',
        as: 'room'
      }
    }
  ])
  const rooms: SendRoom[] = []
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const room = doc.room[0]
    rooms.push({
      id: room._id.toHexString(),
      name: room.name,
      iconUrl: createRoomIconPath(room),
      unread: doc.unreadCounter ? doc.unreadCounter : 0,
      replied: doc.replied ? doc.replied : 0,
      status: room.status === db.RoomStatusEnum.OPEN ? 'open' : 'close'
    })
  }
  return rooms
}

export const getAllUserIdsInRoom = async (roomId: string) => {
  const cursor = await db.collections.enter.find({
    roomId: new ObjectId(roomId)
  })

  const userIds: string[] = []
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    userIds.push(doc.userId.toHexString())
  }
  return userIds
}
