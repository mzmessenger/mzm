import type { Request } from 'express'
import { apis } from 'mzm-shared/api/universal'
import { ObjectId, type WithId, type Document } from 'mongodb'
import { z } from 'zod'
import { BadRequest } from 'mzm-shared/lib/errors'
import * as config from '../config.js'
import { createHandlerWithContext } from '../lib/wrap.js'
import { getRequestUserId, createContextParser } from '../lib/utils.js'
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

const createRoomContext = () => {
  const api = apis['/api/rooms'].POST

  const body = createContextParser(
    z.object({
      name: z.string().min(1)
    }),
    (parsed) => {
      return {
        success: true,
        data: api.request.body({
          name: parsed.data.name
        })
      }
    }
  )

  return {
    api,
    parser: {
      body
    }
  }
}

export const createRoom = createHandlerWithContext(
  '/api/rooms',
  'post',
  createRoomContext()
)(async function (req: Request, context) {
  const user = getRequestUserId(req)
  const body = context.parser.body(req.body)
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
    return context.api.response[200].body({ id: '', name: '' })
  }

  return context.api.response[200].body({
    id: created._id.toHexString(),
    name
  })
})

const exitRoomContext = () => {
  const api = apis['/api/rooms/enter'].DELETE

  const body = createContextParser(
    z.object({
      room: z.string().min(1)
    }),
    (parsed) => {
      return {
        success: true,
        data: api.request.body({
          room: parsed.data.room
        })
      }
    }
  )

  return {
    api,
    parser: {
      body
    }
  }
}

export const exitRoom = createHandlerWithContext(
  '/api/rooms/enter',
  'delete',
  exitRoomContext()
)(async (req: Request, context) => {
  const body = context.parser.body(req.body)
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

const getUserContext = () => {
  const api = apis['/api/rooms/:roomid/users'].GET

  const params = createContextParser(
    z.object({
      roomid: z.string().min(1)
    }),
    (parsed) => {
      return {
        success: true,
        data: apis['/api/rooms/:roomid/users'].params({
          roomid: parsed.data.roomid
        })
      }
    }
  )

  const query = createContextParser(
    z.object({
      threshold: z.string().optional()
    }),
    (parsed) => {
      return {
        success: true,
        data: api.request.query({
          threshold: parsed.data.threshold
        })
      }
    }
  )

  return {
    api,
    parser: {
      params,
      query
    }
  }
}

export const getUsers = createHandlerWithContext(
  '/api/rooms/:roomid/users',
  'get',
  getUserContext()
)(async function (req: Request, context) {
  const parsedParams = context.parser.params(req.params)
  if (parsedParams.success === false) {
    throw new BadRequest({ reason: parsedParams.error.message })
  }

  const q = context.parser.query(req.query)
  if (q.success === false) {
    throw new BadRequest({ reason: q.error.message })
  }

  const roomId = new ObjectId(parsedParams.data.roomid)

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

  const threshold = q.data.threshold
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

  type EnterUser = ReturnType<
    (typeof context.api.response)[200]['body']
  >['users'][number]

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
  return context.api.response[200].body({ count, users })
})

const searchContext = () => {
  const api = apis['/api/rooms/search'].GET
  const query = createContextParser(
    z.object({
      query: z.string().optional(),
      scroll: z.string().optional()
    }),
    (parsed) => {
      return {
        success: true,
        data: api.request.query({
          query: parsed.data.query,
          scroll: parsed.data.scroll
        })
      }
    }
  )

  return {
    api,
    parser: { query }
  }
}

export const search = createHandlerWithContext(
  '/api/rooms/search',
  'get',
  searchContext()
)(async function (req: Request, context) {
  const q = context.parser.query(req.query)
  if (q.success === false) {
    throw new BadRequest({ reason: q.error.message })
  }

  const res = await searchRoom(q.data.query ?? null, q.data.scroll ?? null)
  return context.api.response[200].body(res)
})
