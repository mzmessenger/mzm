import { Request } from 'express'
import { ObjectId, WithId } from 'mongodb'
import isEmpty from 'validator/lib/isEmpty'
import type { RESPONSE, REQUEST } from 'mzm-shared/type/api'
import * as config from '../config'
import { BadRequest } from '../lib/errors'
import { getRequestUserId } from '../lib/utils'
import * as db from '../lib/db'
import { searchRoom } from '../lib/elasticsearch/rooms'
import { popParam, createUserIconPath } from '../lib/utils'
import {
  isValidateRoomName,
  enterRoom as enterRoomLogic,
  createRoom as createRoomLogic
} from '../logic/rooms'

export const createRoom = async (
  req: Request
): Promise<RESPONSE['/api/rooms']['POST']> => {
  const user = getRequestUserId(req)
  const body = req.body as Partial<REQUEST['/api/rooms']['POST']['body']>
  const name = popParam(decodeURIComponent(body.name))
  const valid = isValidateRoomName(name)
  if (!valid.valid) {
    throw new BadRequest({ reason: valid.reason })
  }

  const found = await db.collections.rooms.findOne({ name: name })
  // @todo throw error if room is rocked
  if (found) {
    await enterRoomLogic(new ObjectId(user), new ObjectId(found._id))
    return { id: found._id.toHexString(), name: found.name }
  }

  const created = await createRoomLogic(new ObjectId(user), name)

  return { id: created._id.toHexString(), name }
}

export const enterRoom = async (req: Request) => {
  const user = getRequestUserId(req)
  const room = popParam(req.body.room)
  if (isEmpty(room)) {
    throw new BadRequest({ reason: 'room is empty' })
  }

  await enterRoomLogic(new ObjectId(user), new ObjectId(room))
}

export const exitRoom = async (req: Request) => {
  const body = req.body as Partial<
    REQUEST['/api/rooms/enter']['DELETE']['body']
  >
  const user = getRequestUserId(req)
  const room = popParam(body.room)
  if (isEmpty(room)) {
    throw new BadRequest({ reason: 'room is empty' })
  }

  const roomId = new ObjectId(room)

  const general = await db.collections.rooms.findOne({
    name: config.room.GENERAL_ROOM_NAME
  })

  if (room === general._id.toHexString()) {
    throw new BadRequest({ reason: 'general room' })
  }

  await db.collections.enter.deleteMany({
    userId: new ObjectId(user),
    roomId
  })
}

type EnterUser = RESPONSE['/api/rooms/:roomid/users']['GET']['users'][number]

export const getUsers = async (
  req: Request
): Promise<RESPONSE['/api/rooms/:roomid/users']['GET']> => {
  const room = popParam(req.params.roomid)
  if (isEmpty(room)) {
    throw new BadRequest({ reason: 'room is empty' })
  }

  const roomId = new ObjectId(room)

  const query: Object[] = [
    {
      $match: { roomId }
    },
    {
      $lookup: {
        from: db.COLLECTION_NAMES.USERS,
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    }
  ]

  const reqQuery = req.query as Partial<
    REQUEST['/api/rooms/:roomid/users']['GET']['query']
  >

  const threshold = popParam(
    typeof reqQuery.threshold === 'string' ? reqQuery.threshold : null
  )
  if (threshold) {
    query.push({
      $match: { _id: { $lt: new ObjectId(threshold) } }
    })
  }

  const countQuery = db.collections.enter.countDocuments({ roomId })

  type AggregateType = WithId<db.Message> & { user: WithId<db.User>[] }

  const enterQuery = db.collections.enter
    .aggregate<AggregateType>(query)
    .sort({ _id: -1 })
    .limit(config.room.USER_LIMIT)

  const [count, cursor] = await Promise.all([countQuery, enterQuery])

  const users: EnterUser[] = []
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const user: EnterUser = {
      userId: doc.userId.toHexString(),
      account: 'removed',
      icon: createUserIconPath('removed'),
      enterId: doc._id.toHexString()
    }
    if (doc.user && doc.user[0]) {
      const [u] = doc.user
      user.account = u.account ? u.account : null
      user.icon = createUserIconPath(u?.account, u?.icon?.version)
    }
    users.push(user)
  }
  return { count, users }
}

export const search = async (
  req: Request
): Promise<RESPONSE['/api/rooms/search']['GET']> => {
  const query = req.query as Partial<
    REQUEST['/api/rooms/search']['GET']['query']
  >
  const _query = popParam(
    typeof query.query === 'string' ? decodeURIComponent(query.query) : null
  )

  const scroll = popParam(
    typeof query.scroll === 'string' ? query.scroll : null
  )

  return await searchRoom(_query, scroll)
}
