import type { MulterFile } from '../../types/index'
import { promisify } from 'util'
import { Request } from 'express'
import { request } from 'undici'
import { ObjectId } from 'mongodb'
import { RESPONSE } from 'mzm-shared/type/api'
import imageSize from 'image-size'
import { NotFound, BadRequest } from '../../lib/errors.js'
import { popParam, getRequestUserId } from '../../lib/utils.js'
import * as storage from '../../lib/storage.js'
import * as db from '../../lib/db.js'
import { logger } from '../../lib/logger.js'
import * as config from '../../config.js'
import { StreamWrapResponse } from '../../types.js'
import { isValidMimetype, createVersion } from './internal.js'

const sizeOf = promisify(imageSize)

const returnIconStream = async (key: string): StreamWrapResponse => {
  const head = await storage.headObject({ Key: key })

  logger.info('[icon:returnIconStream]', key, JSON.stringify(head))

  return {
    headers: {
      ETag: head.ETag,
      'content-type': head.ContentType,
      'content-length': `${head.ContentLength}`,
      'last-modified': head.LastModified.toUTCString(),
      'cache-control': head.CacheControl || 'max-age=604800'
    },
    stream: storage.getObject({ Key: key }).createReadStream()
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

export const getUserIcon = async (req: Request): StreamWrapResponse => {
  const account = popParam(req.params.account)
  if (!account) {
    throw new BadRequest(`no account`)
  }
  const version = popParam(req.params.version)
  const user = await db.collections.users.findOne({ account: account })

  if (user?.icon?.version === version) {
    try {
      return await returnIconStream(user.icon.key)
    } catch (e) {
      if (e.statusCode === 404) {
        return await fromIdenticon(account)
      }
      throw e
    }
  }

  return await fromIdenticon(account)
}

export const getRoomIcon = async (req: Request): StreamWrapResponse => {
  const roomName = popParam(req.params.roomname)
  if (!roomName) {
    throw new BadRequest(`no room id`)
  }
  const version = popParam(req.params.version)
  const room = await db.collections.rooms.findOne({ name: roomName })

  if (room?.icon?.version !== version) {
    throw new NotFound('no image')
  }

  try {
    return await returnIconStream(room.icon.key)
  } catch (e) {
    if (e.statusCode === 404) {
      throw new NotFound('icon not found')
    }
    throw e
  }
}

export const uploadUserIcon = async (
  req: Request & { file?: MulterFile }
): Promise<RESPONSE['/api/icon/user']['POST']> => {
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

  const update: Pick<db.User, 'icon'> = {
    icon: { key: iconKey, version }
  }

  await db.collections.users.findOneAndUpdate(
    { _id: new ObjectId(userId) },
    { $set: update },
    {
      upsert: true
    }
  )

  logger.info('[icon:user] upload', userId, version)

  return {
    version: version
  }
}

export const uploadRoomIcon = async (
  req: Request & { file?: MulterFile }
): Promise<RESPONSE['/api/icon/rooms/:roomname']['POST']> => {
  const roomName = popParam(req.params.roomname)
  if (!roomName) {
    throw new BadRequest(`no room id`)
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

  const room = await db.collections.rooms.findOne({ name: roomName })
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

  const update: Pick<db.Room, 'icon'> = {
    icon: { key: iconKey, version }
  }

  await db.collections.rooms.findOneAndUpdate(
    { _id: room._id },
    { $set: update },
    {
      upsert: true
    }
  )

  logger.info('[icon:room] upload', roomName, version)

  return {
    id: room._id.toHexString(),
    version: version
  }
}
