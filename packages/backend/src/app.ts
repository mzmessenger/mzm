import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import multer from 'multer'
import helmet from 'helmet'
import { MULTER_PATH, CORS_ORIGIN } from './config.js'
import { wrap, streamWrap } from './lib/wrap.js'
import * as rooms from './handlers/rooms.js'
import * as user from './handlers/users.js'
import * as icon from './handlers/icon/index.js'
import * as internal from './handlers/internal.js'
import {
  checkAccessToken,
  checkInternalAccessToken,
  errorHandler
} from './middleware/index.js'

const iconUpload = multer({
  dest: MULTER_PATH,
  limits: { fileSize: 1000 * 1000 }
})

const jsonParser = bodyParser.json({ limit: '1mb' })

export const createApp = () => {
  const app = express()
  app.use(helmet())
  app.use(
    cors({
      origin: CORS_ORIGIN
    })
  )

  app.post('/api/rooms', checkAccessToken, jsonParser, wrap(rooms.createRoom))
  app.post(
    '/api/rooms/enter',
    checkAccessToken,
    jsonParser,
    wrap(rooms.enterRoom)
  )
  app.delete(
    '/api/rooms/enter',
    checkAccessToken,
    jsonParser,
    wrap(rooms.exitRoom)
  )
  app.get('/api/rooms/search', wrap(rooms.search))
  app.get('/api/rooms/:roomid/users', checkAccessToken, wrap(rooms.getUsers))
  app.get('/api/user/@me', checkAccessToken, wrap(user.getUserInfo))
  app.put('/api/user/@me', checkAccessToken, jsonParser, wrap(user.update))
  app.post(
    '/api/user/@me/account',
    checkAccessToken,
    jsonParser,
    wrap(user.updateAccount)
  )

  app.get('/api/icon/user/:account', streamWrap(icon.getUserIcon))
  app.get('/api/icon/user/:account/:version', streamWrap(icon.getUserIcon))
  app.post(
    '/api/icon/user',
    checkAccessToken,
    iconUpload.single('icon'),
    wrap(icon.uploadUserIcon)
  )
  app.get('/api/icon/rooms/:roomname/:version', streamWrap(icon.getRoomIcon))
  app.post(
    '/api/icon/rooms/:roomname',
    checkAccessToken,
    iconUpload.single('icon'),
    wrap(icon.uploadRoomIcon)
  )

  app.post(
    '/api/internal/socket',
    checkInternalAccessToken,
    jsonParser,
    wrap(internal.socket)
  )

  // 必ず最後に use する
  app.use(errorHandler)

  return app
}
