import express from 'express'
import bodyParser from 'body-parser'
import multer from 'multer'
import helmet from 'helmet'
import { MULTER_PATH } from './config'
import { wrap, streamWrap } from './lib/wrap'
import * as rooms from './handlers/rooms'
import * as user from './handlers/users'
import * as icon from './handlers/icon'
import * as internal from './handlers/internal'
import { checkLogin, errorHandler } from './middleware'

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
  app.get('/api/user/@me', checkLogin, wrap(user.getUserInfo))
  app.put('/api/user/@me', checkLogin, jsonParser, wrap(user.update))
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
