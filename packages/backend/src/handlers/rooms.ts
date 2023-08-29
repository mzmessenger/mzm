import type { API } from 'mzm-shared/type/api'
import type { Result } from 'mzm-shared/type'
import type { Request } from 'express'
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
  const body = createContextParser(
    z.object({
      name: z.string().min(1)
    }),
    (parsed): Result<API['/api/rooms']['POST']['REQUEST']['body']> => {
      return {
        success: true,
        data: {
          name: parsed.data.name
        }
      }
    }
  )

  return {
    parser: {
      body
    }
  }
}

export const createRoom = createHandlerWithContext(
  '/api/rooms',
  'post',
  createRoomContext()
)(async function (
  req: Request,
  context
): Promise<API['/api/rooms']['POST']['RESPONSE'][200]> {
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
    return { id: '', name: '' }
  }

  return { id: created._id.toHexString(), name }
})

const exitRoomContext = () => {
  const body = createContextParser(
    z.object({
      room: z.string().min(1)
    }),
    (parsed): Result<API['/api/rooms/enter']['DELETE']['REQUEST']['body']> => {
      return {
        success: true,
        data: {
          room: parsed.data.room
        }
      }
    }
  )

  return {
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
  const params = createContextParser(
    z.object({
      roomid: z.string().min(1)
    }),
    (
      parsed
    ): Result<API['/api/rooms/:roomid/users']['GET']['REQUEST']['params']> => {
      return {
        success: true,
        data: {
          roomid: parsed.data.roomid
        }
      }
    }
  )

  return {
    parser: {
      params
    }
  }
}

export const getUsers = createHandlerWithContext(
  '/api/rooms/:roomid/users',
  'get',
  getUserContext()
)(async function (
  req: Request,
  context
): Promise<API['/api/rooms/:roomid/users']['GET']['RESPONSE'][200]> {
  const parsedParams = context.parser.params(req.params)
  if (parsedParams.success === false) {
    throw new BadRequest({ reason: parsedParams.error.message })
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

  type EnterUser =
    API['/api/rooms/:roomid/users']['GET']['RESPONSE'][200]['users'][number]

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

const searchContext = () => {
  const query = createContextParser(
    z.object({
      query: z.string().optional(),
      scroll: z.string().optional()
    }),
    (parsed): Result<API['/api/rooms/search']['GET']['REQUEST']['query']> => {
      return {
        success: true,
        data: {
          query: parsed.data.query,
          scroll: parsed.data.scroll
        }
      }
    }
  )

  return {
    parser: { query }
  }
}

export const search = createHandlerWithContext(
  '/api/rooms/search',
  'get',
  searchContext()
)(async function (
  req: Request,
  context
): Promise<API['/api/rooms/search']['GET']['RESPONSE'][200]> {
  const q = context.parser.query(req.query)
  if (q.success === false) {
    throw new BadRequest({ reason: q.error.message })
  }

  return await searchRoom(q.data.query ?? null, q.data.scroll ?? null)
})
