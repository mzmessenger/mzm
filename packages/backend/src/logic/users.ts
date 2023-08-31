import { ObjectId, WithId } from 'mongodb'
import { TO_CLIENT_CMD, FilterToClientType } from 'mzm-shared/src/type/socket'
import * as config from '../config.js'
import { logger } from '../lib/logger.js'
import {
  collections,
  mongoClient,
  RoomStatusEnum,
  COLLECTION_NAMES,
  type Enter,
  type Room
} from '../lib/db.js'
import { createRoomIconPath } from '../lib/utils.js'
import { enterRoom } from './rooms.js'

type SendRoomType = FilterToClientType<
  typeof TO_CLIENT_CMD.ROOMS_GET
>['rooms'][number]

const enterGeneral = async (userId: ObjectId) => {
  const general = await collections(await mongoClient()).rooms.findOne({
    name: config.room.GENERAL_ROOM_NAME
  })
  await enterRoom(userId, general!._id)
}

export const initUser = async (userId: ObjectId, account: string) => {
  const db = await mongoClient()
  const [user] = await Promise.all([
    collections(db).users.findOneAndUpdate(
      {
        _id: userId
      },
      {
        $set: {
          account: `${account}_${userId.toHexString()}`,
          roomOrder: []
        }
      },
      {
        upsert: true
      }
    ),
    enterGeneral(userId)
  ])
  logger.info('[logic/user] initUser', userId, account)
  return user
}

export const getRooms = async (userId: string): Promise<SendRoomType[]> => {
  type AggregateType = WithId<Enter> & { room: WithId<Room>[] }

  const db = await mongoClient()
  const cursor = await collections(db).enter.aggregate<AggregateType>([
    { $match: { userId: new ObjectId(userId) } },
    {
      $lookup: {
        from: COLLECTION_NAMES.ROOMS,
        localField: 'roomId',
        foreignField: '_id',
        as: 'room'
      }
    }
  ])
  const rooms: SendRoomType[] = []
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const room = doc.room[0]
    rooms.push({
      id: room._id.toHexString(),
      name: room.name,
      description: room.description || '',
      iconUrl: createRoomIconPath(room),
      unread: doc.unreadCounter ? doc.unreadCounter : 0,
      replied: doc.replied ? doc.replied : 0,
      status: room.status === RoomStatusEnum.OPEN ? 'open' : 'close'
    })
  }
  return rooms
}

export const getAllUserIdsInRoom = async (roomId: string) => {
  const cursor = await collections(await mongoClient()).enter.find({
    roomId: new ObjectId(roomId)
  })

  const userIds: string[] = []
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    userIds.push(doc.userId.toHexString())
  }
  return userIds
}
