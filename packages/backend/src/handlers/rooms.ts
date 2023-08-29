import type { API } from 'mzm-shared/type/api'
import type { Request } from 'express'
import { ObjectId, type WithId, type Document } from 'mongodb'
import { z } from 'zod'
import { BadRequest } from 'mzm-shared/lib/errors'
import * as config from '../config.js'
import { createHandler } from '../lib/wrap.js'
import { getRequestUserId } from '../lib/utils.js'
import {
  collections,
  mongoClient,
  COLLECTION_NAMES,
  type Message,
  type User
} from '../lib/db.js'
import { searchRoom } from '../lib/elasticsearch/rooms.js'
import { popParam, createUserIconPath } from '../lib/utils.js'
import {
  isValidateRoomName,
  enterRoom as enterRoomLogic,
  createRoom as createRoomLogic
} from '../logic/rooms.js'

const createRoomParser = z.object({
  name: z.string().min(1)
})

export const createRoom = createHandler(
  '/api/rooms',
  'post'
)(async function (
  req: Request
): Promise<API['/api/rooms']['POST']['RESPONSE'][200]> {
  const user = getRequestUserId(req)
  const body = createRoomParser.safeParse(req.body)
  if (body.success === false) {
    throw new BadRequest({ reason: body.error.message })
  }
  const name = body.data.name.trim()
  const valid = isValidateRoomName(name)
  if (!valid.valid) {
    throw new BadRequest({ reason: valid.reason })
  }

  const found = await collections(await mongoClient()).rooms.findOne({
    name: name
  })
  // @todo throw error if room is rocked
  if (found) {
    await enterRoomLogic(new ObjectId(user), new ObjectId(found._id))
    return { id: found._id.toHexString(), name: found.name }
  }

  const created = await createRoomLogic(new ObjectId(user), name)

  // @todo
  if (!created) {
    return { id: '', name: '' }
  }

  return { id: created._id.toHexString(), name }
})

export const enterRoom = createHandler(
  '/api/rooms/enter',
  'post'
)(async (req: Request) => {
  const user = getRequestUserId(req)
  const room = popParam(req.body.room)
  if (!room) {
    throw new BadRequest({ reason: 'room is empty' })
  }

  await enterRoomLogic(new ObjectId(user), new ObjectId(room))
})

const exitRoomParser = z.object({
  room: z.string().min(1)
})

export const exitRoom = createHandler(
  '/api/rooms/enter',
  'delete'
)(async (req: Request) => {
  const body = exitRoomParser.safeParse(req.body)
  if (body.success === false) {
    throw new BadRequest({ reason: body.error.message })
  }
  const room = popParam(body.data.room)
  const user = getRequestUserId(req)

  const roomId = new ObjectId(room)

  const db = await mongoClient()
  const general = await collections(db).rooms.findOne({
    name: config.room.GENERAL_ROOM_NAME
  })

  if (!general) {
    return
  }

  if (room === general._id.toHexString()) {
    throw new BadRequest({ reason: 'general room' })
  }

  await collections(db).enter.deleteMany({
    userId: new ObjectId(user),
    roomId
  })
})

type EnterUser =
  API['/api/rooms/:roomid/users']['GET']['RESPONSE'][200]['users'][number]

const getUsersParser = z.object({
  roomid: z.string().min(1)
})

export const getUsers = createHandler(
  '/api/rooms/:roomid/users',
  'get'
)(async function (
  req: Request
): Promise<API['/api/rooms/:roomid/users']['GET']['RESPONSE'][200]> {
  const room = popParam(req.params.roomid)
  const params = getUsersParser.safeParse(req.params)
  if (params.success === false) {
    throw new BadRequest({ reason: params.error.message })
  }

  const roomId = new ObjectId(room)

  const query: Document[] = [
    {
      $match: { roomId }
    },
    {
      $lookup: {
        from: COLLECTION_NAMES.USERS,
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    }
  ]

  const reqQuery = req.query as Partial<
    API['/api/rooms/:roomid/users']['GET']['REQUEST']['query']
  >

  const threshold = popParam(
    typeof reqQuery.threshold === 'string' ? reqQuery.threshold : undefined
  )
  if (threshold) {
    query.push({
      $match: { _id: { $lt: new ObjectId(threshold) } }
    })
  }

  const db = await mongoClient()
  const countQuery = collections(db).enter.countDocuments({ roomId })

  type AggregateType = WithId<Message> & { user: WithId<User>[] }

  const enterQuery = collections(db)
    .enter.aggregate<AggregateType>(query)
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
      user.account = u.account
      user.icon = createUserIconPath(u?.account, u?.icon?.version)
    }
    users.push(user)
  }
  return { count, users }
})

export const search = createHandler(
  '/api/rooms/search',
  'get'
)(async function (
  req: Request
): Promise<API['/api/rooms/search']['GET']['RESPONSE'][200]> {
  const query = req.query as Partial<
    API['/api/rooms/search']['GET']['REQUEST']['query']
  >
  const _query = popParam(
    typeof query.query === 'string'
      ? decodeURIComponent(query.query)
      : undefined
  )

  const scroll = popParam(
    typeof query.scroll === 'string' ? query.scroll : undefined
  )

  return await searchRoom(_query, scroll)
})
