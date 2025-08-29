import { ObjectId, type MongoClient, type WithId, type Document } from 'mongodb'
import { RoomStatusEnum } from 'mzm-shared/src/type/db'
import { type API } from 'mzm-shared/src/api/universal'
import {
  collections,
  COLLECTION_NAMES,
  type Enter,
  type Room
} from '../../lib/db.js'
import { createRoomIconPath } from '../../lib/utils.js'
import { room } from '../../config.js'

export async function listRooms({
  db,
  userId,
  threshold
}: {
  db: MongoClient
  userId: ObjectId
  threshold: string | null
}) {
  type AggregateType = WithId<Room> & { enter: WithId<Enter>[] }

  const aggregateQuery: Document[] = [
    {
      $lookup: {
        from: COLLECTION_NAMES.ENTER,
        localField: '_id',
        foreignField: 'roomId',
        as: 'enter',
        pipeline: [
          {
            $match: {
              userId: userId
            }
          }
        ]
      }
    },
    {
      $match: {
        $or: [
          { status: RoomStatusEnum.OPEN },
          {
            $and: [{ status: RoomStatusEnum.CLOSE }, { 'enter.userId': userId }]
          }
        ]
      }
    }
  ]

  const listQuery = [...aggregateQuery]
  if (threshold !== null && ObjectId.isValid(threshold)) {
    listQuery.push({
      $match: { _id: { $gt: new ObjectId(threshold) } }
    })
  }

  const [cursor, [_total]] = await Promise.all([
    collections(db).rooms.aggregate<AggregateType>(listQuery).limit(room.LIST_LIMIT),
    collections(db)
      .rooms.aggregate([
        ...aggregateQuery,
        {
          $count: 'roomsCount'
        }
      ])
      .toArray()
  ])
  const rooms: API['/api/rooms']['GET']['response'][200]['body']['rooms'] = []
  for await (const doc of cursor) {
    const room = {
      id: doc._id.toHexString(),
      name: doc.name,
      description: doc.description,
      iconUrl: createRoomIconPath(doc),
      status: doc.status
    } satisfies (typeof rooms)[number]
    rooms.push(room)
  }
  const total = _total?.roomsCount ?? 0

  return {
    rooms,
    total
  } satisfies API['/api/rooms']['GET']['response'][200]['body']
}
