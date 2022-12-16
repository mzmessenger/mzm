import express from 'express'
import bodyParser from 'body-parser'
import multer from 'multer'
import helmet from 'helmet'
import { MULTER_PATH } from './config.js'
import { wrap, streamWrap } from './lib/wrap.js'
import * as rooms from './handlers/rooms.js'
import * as user from './handlers/users.js'
import * as icon from './handlers/icon/index.js'
import * as internal from './handlers/internal.js'
import {
  checkAccessToken,
  checkLogin,
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

  app.post('/api/rooms', checkLogin, jsonParser, wrap(rooms.createRoom))
  app.post('/api/rooms/enter', checkLogin, jsonParser, wrap(rooms.enterRoom))
  app.delete('/api/rooms/enter', checkLogin, jsonParser, wrap(rooms.exitRoom))
  app.get('/api/rooms/search', wrap(rooms.search))
  app.get('/api/rooms/:roomid/users', checkLogin, wrap(rooms.getUsers))
  app.get('/api/user/@me', checkAccessToken, wrap(user.getUserInfo))
  app.put('/api/user/@me', checkAccessToken, jsonParser, wrap(user.update))
  app.post(
    '/api/user/@me/account',
    checkLogin,
    jsonParser,
    wrap(user.updateAccount)
  )

  app.get('/api/icon/user/:account', streamWrap(icon.getUserIcon))
  app.get('/api/icon/user/:account/:version', streamWrap(icon.getUserIcon))
  app.post(
    '/api/icon/user',
    checkLogin,
    iconUpload.single('icon'),
    wrap(icon.uploadUserIcon)
  )
  app.get('/api/icon/rooms/:roomname/:version', streamWrap(icon.getRoomIcon))
  app.post(
    '/api/icon/rooms/:roomname',
    checkLogin,
    iconUpload.single('icon'),
    wrap(icon.uploadRoomIcon)
  )

  app.post('/api/internal/socket', jsonParser, wrap(internal.socket))

  // 必ず最後に use する
  app.use(errorHandler)

  return app
}
