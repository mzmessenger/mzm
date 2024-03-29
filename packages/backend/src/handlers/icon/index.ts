import type { MulterFile } from '../../types/index.js'
import type { Readable } from 'stream'
import { apis } from 'mzm-shared/src/api/universal'
import { Request } from 'express'
import { request } from 'undici'
import { ObjectId } from 'mongodb'
import { z } from 'zod'
import { BadRequest, NotFound } from 'mzm-shared/src/lib/errors'
import { getRequestUserId, createContextParser } from '../../lib/utils.js'
import { createHandler, createStreamHandler } from '../../lib/wrap.js'
import * as storage from '../../lib/storage.js'
import { collections, mongoClient, type User, type Room } from '../../lib/db.js'
import { logger } from '../../lib/logger.js'
import * as config from '../../config.js'
import { StreamWrapResponse } from '../../types.js'
import { isValidMimetype, createVersion } from './internal.js'
import { sizeOf } from '../../lib/image.js'

const returnIconStream = async (key: string): StreamWrapResponse => {
  const head = await storage.headObject({ Key: key })

  logger.info('[icon:returnIconStream]', key, JSON.stringify(head))

  const res = await storage.getObject({ Key: key })
  if (!res.Body) {
    throw new NotFound('')
  }

  return {
    headers: {
      ETag: head.ETag,
      'content-type': head.ContentType,
      'content-length': `${head.ContentLength}`,
      'last-modified': head.LastModified?.toUTCString(),
      'cache-control': head.CacheControl || 'max-age=604800'
    },
    stream: res.Body as Readable
  }
}

const fromIdenticon = async (account: string): StreamWrapResponse => {
  const res = await request(
    `https://identicon.mzm.dev/api/identicon/${account}`,
    {
      method: 'GET'
    }
  )
  return { headers: res.headers, stream: res.body }
}

export const getUserIcon = createStreamHandler(
  '/api/icon/user/:account',
  'GET',
  ({ path, method }) => {
    const api = apis[path][method]
    const params = createContextParser(
      z.object({
        account: z.string().min(1)
      }),
      (parsed) => {
        return {
          success: true,
          data: api.request.params({
            account: parsed.data.account
          })
        }
      }
    )
    return {
      parser: {
        params,
        version: z.object({
          version: z.string().optional()
        })
      }
    }
  }
)(async (req, context) => {
  const params = context.parser.params(req.params)
  if (!params.success) {
    throw new BadRequest(`no account`)
  }
  const v = context.parser.version.safeParse(req.params)
  const version = v.success ? v.data.version : null
  const db = await mongoClient()
  const user = await collections(db).users.findOne({
    account: params.data.account
  })

  if (!user) {
    throw new BadRequest(`no account`)
  }

  if (!user.icon) {
    return await fromIdenticon(params.data.account)
  }

  if (version) {
    if (user?.icon?.version !== version) {
      return await fromIdenticon(params.data.account)
    }
    try {
      return await returnIconStream(user.icon.key)
    } catch (e) {
      if ((e as { statusCode: number })?.statusCode === 404) {
        return await fromIdenticon(params.data.account)
      }
      throw e
    }
  }

  try {
    return await returnIconStream(user.icon.key)
  } catch (e) {
    if ((e as { statusCode: number })?.statusCode === 404) {
      return await fromIdenticon(params.data.account)
    }
    throw e
  }
})

export const getRoomIcon = createStreamHandler(
  '/api/icon/rooms/:roomName/:version',
  'GET',
  ({ path, method }) => {
    const api = apis[path][method]
    const params = createContextParser(
      z.object({
        roomName: z.string().min(1),
        version: z.string().min(1)
      }),
      (parsed) => {
        return {
          success: true,
          data: api.request.params({
            roomName: parsed.data.roomName,
            version: parsed.data.version
          })
        }
      }
    )
    return {
      parser: {
        params
      }
    }
  }
)(async (req, context) => {
  const params = context.parser.params(req.params)
  if (!params.success) {
    throw new BadRequest(`invalid params`)
  }
  const roomName = params.data.roomName
  const version = params.data.version
  const db = await mongoClient()
  const room = await collections(db).rooms.findOne({ name: roomName })

  if (room?.icon?.version !== version) {
    throw new NotFound('no image')
  }

  try {
    return await returnIconStream(room.icon.key)
  } catch (e) {
    if ((e as { statusCode: number })?.statusCode === 404) {
      throw new NotFound('icon not found')
    }
    throw e
  }
})

export const uploadUserIcon = createHandler(
  '/api/icon/user',
  'POST',
  ({ path, method }) => {
    return {
      api: apis[path][method]
    }
  }
)(async (req: Request & { file?: MulterFile }, context) => {
  const userId = getRequestUserId(req)
  if (!userId) {
    throw new NotFound('not found')
  }

  if (!req.file) {
    throw new BadRequest(`file is empty`)
  }

  const file = req.file
  if (!isValidMimetype(file.mimetype)) {
    throw new BadRequest(`${file.mimetype} is not allowed`)
  }

  const dimensions = await sizeOf(file.path)

  if (
    dimensions.width > config.icon.MAX_USER_ICON_SIZE ||
    dimensions.height > config.icon.MAX_USER_ICON_SIZE
  ) {
    throw new BadRequest(`size over: ${config.icon.MAX_USER_ICON_SIZE}`)
  } else if (dimensions.width !== dimensions.height) {
    throw new BadRequest(`not square: ${JSON.stringify(dimensions)}`)
  }

  const ext = file.mimetype === 'image/png' ? '.png' : '.jpeg'
  const iconKey = config.icon.USER_ICON_PREFIX + userId + ext
  const version = await createVersion()

  await storage.putObject({
    Key: iconKey,
    Body: storage.createBodyFromFilePath(file.path),
    ContentType: file.mimetype,
    CacheControl: 'max-age=604800'
  })

  const update: Pick<User, 'icon'> = {
    icon: { key: iconKey, version }
  }

  const db = await mongoClient()
  await collections(db).users.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: update },
    {
      upsert: true
    }
  )

  logger.info('[icon:user] upload', userId, version)

  return context.api.response[200].body({
    version: version
  })
})

export const uploadRoomIcon = createHandler(
  '/api/icon/rooms/:roomName',
  'POST',
  ({ path, method }) => {
    const api = apis[path][method]
    const params = createContextParser(
      z.object({
        roomName: z.string().min(1)
      }),
      (parsed) => {
        return {
          success: true,
          data: api.request.params({
            roomName: parsed.data.roomName
          })
        }
      }
    )

    return {
      api,
      parser: { params }
    }
  }
)(async (req: Request & { file?: MulterFile }, context) => {
  const params = context.parser.params(req.params)
  if (params.success === false) {
    throw new BadRequest(`invalid room name`)
  }

  if (!req.file) {
    throw new BadRequest('file is empty')
  }

  const file = req.file
  if (!isValidMimetype(file.mimetype)) {
    throw new BadRequest(`${file.mimetype} is not allowed`)
  }

  const dimensions = await sizeOf(file.path)

  if (
    dimensions.width > config.icon.MAX_ROOM_ICON_SIZE ||
    dimensions.height > config.icon.MAX_ROOM_ICON_SIZE
  ) {
    throw new BadRequest(`size over: ${config.icon.ROOM_ICON_PREFIX}`)
  } else if (dimensions.width !== dimensions.height) {
    throw new BadRequest(`not square: ${JSON.stringify(dimensions)}`)
  }

  const db = await mongoClient()
  const room = await collections(db).rooms.findOne({
    name: params.data.roomName
  })
  if (!room) {
    throw new NotFound('not exist')
  }

  const ext = file.mimetype === 'image/png' ? '.png' : '.jpeg'
  const iconKey = config.icon.ROOM_ICON_PREFIX + room._id + ext
  const version = await createVersion()

  await storage.putObject({
    Key: iconKey,
    Body: storage.createBodyFromFilePath(file.path),
    ContentType: file.mimetype,
    CacheControl: 'max-age=604800'
  })

  const update: Pick<Room, 'icon'> = {
    icon: { key: iconKey, version }
  }

  await collections(db).rooms.findOneAndUpdate(
    { _id: room._id },
    { $set: update },
    {
      upsert: true
    }
  )

  logger.info('[icon:room] upload', params.data.roomName, version)

  return context.api.response[200].body({
    id: room._id.toHexString(),
    version: version
  })
})
