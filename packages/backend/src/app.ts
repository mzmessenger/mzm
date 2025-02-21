import type { MulterFile } from './types/index.js'
import express, { type Request } from 'express'
import cors from 'cors'
import multer from 'multer'
import helmet from 'helmet'
import { createErrorHandler } from 'mzm-shared/src/lib/middleware'
import { MULTER_PATH, CORS_ORIGIN } from './config.js'
import { streamWrap } from './lib/wrap.js'
import { logger } from './lib/logger.js'
import {
  getRequestUserId,
  getRequestGithubUserName,
  getRequestTwitterUserName
} from './lib/utils.js'
import { addUserResponse, closeUserResponse } from './lib/fetchStreaming.js'
import { wrap } from 'mzm-shared/src/lib/wrap'
import * as rooms from './handlers/rooms.js'
import * as user from './handlers/users.js'
import * as icon from './handlers/icon/index.js'
import * as internal from './handlers/internal.js'
import { connection } from './handlers/socket/connection.js'
import {
  checkAccessToken,
  checkInternalAccessToken
} from './middleware/index.js'

const iconUpload = multer({
  dest: MULTER_PATH,
  limits: { fileSize: 1000 * 1000 }
})

const jsonParser = express.json({ limit: '1mb' })

export const createApp = () => {
  const app = express()
  app.use(helmet())
  app.use(
    cors({
      origin: CORS_ORIGIN
    })
  )

  app[rooms.createRoom.method](
    rooms.createRoom.path,
    checkAccessToken,
    jsonParser,
    wrap(rooms.createRoom.handler)
  )
  app[rooms.exitRoom.method](
    rooms.exitRoom.path,
    checkAccessToken,
    jsonParser,
    wrap(rooms.exitRoom.handler)
  )
  app[rooms.search.method](rooms.search.path, wrap(rooms.search.handler))
  app[rooms.getUsers.method](
    rooms.getUsers.path,
    checkAccessToken,
    wrap(rooms.getUsers.handler)
  )
  app[user.getUserInfo.method](
    user.getUserInfo.path,
    checkAccessToken,
    wrap(user.getUserInfo.handler)
  )
  app[user.update.method](
    user.update.path,
    checkAccessToken,
    jsonParser,
    wrap(user.update.handler)
  )
  app[icon.getUserIcon.method](
    icon.getUserIcon.path,
    streamWrap(icon.getUserIcon.handler)
  )
  app[icon.getUserIcon.method](
    '/api/icon/user/:account/:version',
    streamWrap(icon.getUserIcon.handler)
  )
  app[icon.uploadUserIcon.method](
    icon.uploadUserIcon.path,
    checkAccessToken,
    iconUpload.single('icon'),
    wrap<Request & { file?: MulterFile }>(icon.uploadUserIcon.handler)
  )
  app[icon.getRoomIcon.method](
    icon.getRoomIcon.path,
    streamWrap(icon.getRoomIcon.handler)
  )
  app[icon.uploadRoomIcon.method](
    icon.uploadRoomIcon.path,
    checkAccessToken,
    iconUpload.single('icon'),
    wrap(icon.uploadRoomIcon.handler)
  )

  app.get('/api/socket', checkAccessToken, (req, res) => {
    const user = getRequestUserId(req)

    addUserResponse(user, res)

    res.on('close', () => {
      closeUserResponse(user, res)
    })

    res.status(200)
    res.set('Content-Type', 'text/plain')

    const twitterUserName = getRequestTwitterUserName(req)
    const githubUserName = getRequestGithubUserName(req)
    connection(user, {
      twitterUserName,
      githubUserName
    }).then((r) => {
      res.write(Buffer.from(JSON.stringify(r)))
      res.write('\0')
    })

    setInterval(() => {
      res.write('ping')
      res.write(Buffer.from('\0'))
    }, 5000)
  })

  app.post('/api/socket', checkAccessToken, jsonParser, wrap(internal.socket))

  app.post(
    '/api/internal/socket',
    checkInternalAccessToken,
    jsonParser,
    wrap(internal.socket)
  )

  app.use(createErrorHandler(logger))

  return app
}
