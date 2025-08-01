import type { MongoClient } from 'mongodb'
import type { Express } from 'express'
import type { checkAccessToken as checkAccessTokenMiddleware } from '../../middleware/index.js'
import type { MulterFile } from '../../types/index.js'
import type { Readable } from 'stream'
import { apis, type API } from 'mzm-shared/src/api/universal'
import { response } from 'mzm-shared/src/lib/wrap'
import multer from 'multer'
import { Request } from 'express'
import { request } from 'undici'
import { ObjectId } from 'mongodb'
import { z } from 'zod'
import { BadRequest, NotFound } from 'mzm-shared/src/lib/errors'
import { getRequestUserId } from '../../lib/utils.js'
import * as storage from '../../lib/storage.js'
import { collections, type User, type Room } from '../../lib/db.js'
import { logger } from '../../lib/logger.js'
import * as config from '../../config.js'
import { isValidMimetype, createVersion } from './internal.js'
import { sizeOf } from '../../lib/image.js'

const iconUpload = multer({
  dest: config.MULTER_PATH,
  limits: { fileSize: 1000 * 1000 }
})

export function createRoute(
  app: Express,
  {
    db,
    checkAccessToken
  }: {
    db: MongoClient
    checkAccessToken: typeof checkAccessTokenMiddleware
  }
) {
  app.get('/api/icon/user/:account', async (req, res, next) => {
    const paramsParser = z.object({
      account: z.string().min(1)
    })
    const parsedParams = paramsParser.safeParse(req.params)
    if (parsedParams.success === false) {
      throw new BadRequest({ reason: parsedParams.error.message })
    }
    const params = apis['/api/icon/user/:account']['GET'].request.params(
      parsedParams.data
    )

    const { headers, stream } = await getUserIcon(db, {
      account: params.account
    })
    res.set(headers)
    stream.pipe(res).on('error', (e) => next(e))
  })
  app.get('/api/icon/user/:account/:version', async (req, res, next) => {
    const paramsParser = z.object({
      account: z.string().min(1),
      version: z.string()
    })
    const parsedParams = paramsParser.safeParse(req.params)
    if (parsedParams.success === false) {
      throw new BadRequest({ reason: parsedParams.error.message })
    }
    const params = apis['/api/icon/user/:account/:version'][
      'GET'
    ].request.params(parsedParams.data)
    const { headers, stream } = await getUserIcon(db, {
      account: params.account,
      version: params.version
    })
    res.set(headers)
    stream.pipe(res).on('error', (e) => next(e))
  })
  app.post(
    '/api/icon/user',
    checkAccessToken,
    iconUpload.single('icon'),
    async (req, res) => {
      const userId = getRequestUserId(req)
      if (!userId) {
        throw new NotFound('not found')
      }

      if (!req.file) {
        throw new BadRequest(`file is empty`)
      }

      const _req = req as Request & { file?: MulterFile }
      const data = await uploadUserIcon(db, {
        userId: new ObjectId(userId),
        file: _req.file
      })
      return response<API['/api/icon/user']['POST']['response'][200]['body']>(
        data
      )(req, res)
    }
  )
  app.get('/api/icon/rooms/:roomName/:version', async (req, res, next) => {
    const paramsParser = z.object({
      roomName: z.string().min(1),
      version: z.string().min(1)
    })
    const parsedParams = paramsParser.safeParse(req.params)
    if (parsedParams.success === false) {
      throw new BadRequest({ reason: parsedParams.error.message })
    }
    const params = apis['/api/icon/rooms/:roomName/:version'][
      'GET'
    ].request.params(parsedParams.data)
    const { headers, stream } = await getRoomIcon(db, {
      roomName: params.roomName,
      version: params.version
    })
    res.set(headers)
    stream.pipe(res).on('error', (e) => next(e))
  })
  app.post(
    '/api/icon/rooms/:roomName',
    checkAccessToken,
    iconUpload.single('icon'),
    async (req, res) => {
      const paramsParser = z.object({
        roomName: z.string().min(1)
      })
      const parsedParams = paramsParser.safeParse(req.params)
      if (parsedParams.success === false) {
        throw new BadRequest(`invalid room name`)
      }
      const params = apis['/api/icon/rooms/:roomName']['POST'].request.params(
        parsedParams.data
      )

      const _req = req as Request & { file?: MulterFile }
      const data = await uploadRoomIcon(db, {
        roomName: params.roomName,
        file: _req.file
      })
      return response<
        API['/api/icon/rooms/:roomName']['POST']['response'][200]['body']
      >(data)(req, res)
    }
  )

  return app
}

async function returnIconStream(key: string) {
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

async function fromIdenticon(account: string) {
  const res = await request(
    `https://identicon.mzm.dev/api/identicon/${account}`,
    {
      method: 'GET'
    }
  )
  return { headers: res.headers, stream: res.body }
}

export async function getUserIcon(
  db: MongoClient,
  { account, version }: { account: string; version?: string }
) {
  const user = await collections(db).users.findOne({
    account: account
  })

  if (!user) {
    throw new BadRequest(`no account`)
  }

  if (!user.icon) {
    return await fromIdenticon(account)
  }

  if (version) {
    if (user?.icon?.version !== version) {
      return await fromIdenticon(account)
    }
    try {
      return await returnIconStream(user.icon.key)
    } catch (e) {
      if ((e as { statusCode: number })?.statusCode === 404) {
        return await fromIdenticon(account)
      }
      throw e
    }
  }

  try {
    return await returnIconStream(user.icon.key)
  } catch (e) {
    if ((e as { statusCode: number })?.statusCode === 404) {
      return await fromIdenticon(account)
    }
    throw e
  }
}

export async function getRoomIcon(
  db: MongoClient,
  { roomName, version }: { roomName: string; version: string }
) {
  if (!roomName) {
    throw new BadRequest('no room name')
  }
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
}

export async function uploadUserIcon(
  db: MongoClient,
  { userId, file }: { userId: ObjectId; file?: MulterFile }
) {
  const api = apis['/api/icon/user']['POST']
  if (!file) {
    throw new BadRequest(`file is empty`)
  }
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

  await collections(db).users.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: update },
    {
      upsert: true
    }
  )

  logger.info('[icon:user] upload', userId, version)

  return api.response[200].body({
    version: version
  })
}

export async function uploadRoomIcon(
  db: MongoClient,
  { roomName, file }: { roomName: string; file?: MulterFile }
) {
  const api = apis['/api/icon/rooms/:roomName']['POST']
  if (!file) {
    throw new BadRequest(`file is empty`)
  }
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

  const room = await collections(db).rooms.findOne({
    name: roomName
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

  logger.info('[icon:room] upload', roomName, version)

  return api.response[200].body({
    id: room._id.toHexString(),
    version: version
  })
}
