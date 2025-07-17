import type { Express, json } from 'express'
import type QueryString from 'qs'
import type { checkAccessToken as checkAccessTokenMiddleware } from '../middleware/index.js'
import { ObjectId, type WithId, type Document } from 'mongodb'
import { z } from 'zod'
import { BadRequest } from 'mzm-shared/src/lib/errors'
import { apis, type API } from 'mzm-shared/src/api/universal'
import { response } from 'mzm-shared/src/lib/wrap'
import * as config from '../config.js'
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

export function createRoute(
  app: Express,
  {
    jsonParser,
    checkAccessToken
  }: {
    jsonParser: ReturnType<typeof json>
    checkAccessToken: typeof checkAccessTokenMiddleware
  }
) {
  app.post(
    '/api/rooms',
    checkAccessToken,
    jsonParser,
    async (req, res) => {
      const userId = getRequestUserId(req)
      const data = await createRoom(new ObjectId(userId), req.body)
      return response<API['/api/rooms']['POST']['response'][200]['body']>(data)(req, res)
    }
  )

  app.delete(
    '/api/rooms/enter',
    checkAccessToken,
    jsonParser,
    async (req, res) => {
      const userId = getRequestUserId(req)
      const data = await exitRoom(new ObjectId(userId), req.body)
      return response<API['/api/rooms/enter']['DELETE']['response'][200]['body']>(data)(req, res)
    }
  )

  app.get(
    '/api/rooms/:roomId/users',
    checkAccessToken,
    async (req, res) => {
      const paramsParser = z.object({
        roomId: z.string().min(1)
      })
      const parsedParams = paramsParser.safeParse(req.params)
      if (parsedParams.success === false) {
        throw new BadRequest({ reason: parsedParams.error.message })
      }
      const params = apis['/api/rooms/:roomId/users']['GET'].request.params(
        parsedParams.data
      )

      const data = await getUsers(params, req.query)
      return response<API['/api/rooms/:roomId/users']['GET']['response'][200]['body']>(data)(req, res)
    }
  )

  app.get(
    '/api/rooms/search',
    checkAccessToken,
    async (req, res) => {
      const data = await search(req.query)
      return response<API['/api/rooms/search']['GET']['response'][200]['body']>(data)(req, res)
    }
  )
  return app
}

export async function createRoom(
  userId: ObjectId,
  reqBody: unknown
) {
  const api = apis['/api/rooms']['POST']
  const bodyParser = z.object({
    name: z.string().min(1)
  })
  const parsedBody = bodyParser.safeParse(reqBody)
  if (parsedBody.success === false) {
    throw new BadRequest({ reason: parsedBody.error.message })
  }
  const body = api.request.body(parsedBody.data)
  const name = body.name.trim()
  const valid = isValidateRoomName(name)
  if (!valid.valid) {
    throw new BadRequest({ reason: valid.reason })
  }

  const found = await collections(await mongoClient()).rooms.findOne({
    name
  })
  // @todo throw error if room is rocked
  if (found) {
    await enterRoomLogic(userId, new ObjectId(found._id))
    return { id: found._id.toHexString(), name: found.name }
  }

  const created = await createRoomLogic(userId, name)

  // @todo
  if (!created) {
    return { id: '', name: '' }
  }

  return api.response[200].body({
    id: created._id.toHexString(),
    name
  })
}

export async function exitRoom(
  userId: ObjectId,
  reqBody: unknown
): Promise<API['/api/rooms/enter']['DELETE']['response'][200]['body']> {
  const bodyParser = z.object({
    room: z.string().min(1)
  })
  const parsedBody = bodyParser.safeParse(reqBody)
  if (parsedBody.success === false) {
    throw new BadRequest({ reason: parsedBody.error.message })
  }
  const api = apis['/api/rooms/enter']['DELETE']
  const body = api.request.body(parsedBody.data)
  const room = popParam(body.room)

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
    userId,
    roomId
  })
}

export async function getUsers(
  params: API['/api/rooms/:roomId/users']['GET']['request']['params'],
  query: QueryString.ParsedQs
) {
  const api = apis['/api/rooms/:roomId/users']['GET']
  const queryParser = z.object({
    threshold: z.string().optional()
  })

  const q = queryParser.safeParse(query)
  if (q.success === false) {
    throw new BadRequest({ reason: q.error.message })
  }

  const roomId = new ObjectId(params.roomId)

  const aggregateQuery: Document[] = [
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
    aggregateQuery.push({
      $match: { _id: { $lt: new ObjectId(threshold) } }
    })
  }

  const db = await mongoClient()
  const countQuery = collections(db).enter.countDocuments({ roomId })

  type AggregateType = WithId<Message> & { user: WithId<User>[] }

  const enterQuery = collections(db)
    .enter.aggregate<AggregateType>(aggregateQuery)
    .sort({ _id: -1 })
    .limit(config.room.USER_LIMIT)

  const [count, cursor] = await Promise.all([countQuery, enterQuery])

  type EnterUser =
    API['/api/rooms/:roomId/users']['GET']['response'][200]['body']['users'][number]

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
  return api.response[200].body({ count, users })
}

async function search(query: QueryString.ParsedQs) {
  const api = apis['/api/rooms/search']['GET']
  const queryParser = z.object({
    query: z.string().optional(),
    scroll: z.string().optional()
  })

  const q = queryParser.safeParse(query)
  if (q.success === false) {
    throw new BadRequest({ reason: q.error.message })
  }

  const res = await searchRoom(q.data.query ?? null, q.data.scroll ?? null)
  return api.response[200].body(res)
}
