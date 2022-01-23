import cluster from 'cluster'
import http from 'http'
import express from 'express'
import bodyParser from 'body-parser'
import multer from 'multer'
import helmet from 'helmet'
import schedule from 'node-schedule'

import { WORKER_NUM, PORT, MULTER_PATH } from './config'
import { logger } from './lib/logger'
import * as redis from './lib/redis'
import * as db from './lib/db'
import { wrap, streamWrap } from './lib/wrap'
import * as rooms from './handlers/rooms'
import * as user from './handlers/users'
import * as icon from './handlers/icon'
import * as internal from './handlers/internal'
import { checkLogin, errorHandler, init } from './logic/server'
import { addSyncSearchRoomQueue } from './lib/provider'

schedule.scheduleJob({ minute: 0 }, () => {
  try {
    addSyncSearchRoomQueue()
  } catch (e) {
    logger.error(e)
  }
})

const iconUpload = multer({
  dest: MULTER_PATH,
  limits: { fileSize: 1000 * 1000 }
})

const app = express()
app.use(helmet())

const jsonParser = bodyParser.json({ limit: '1mb' })

app.post('/api/rooms', checkLogin, jsonParser, wrap(rooms.createRoom))
app.post('/api/rooms/enter', checkLogin, jsonParser, wrap(rooms.enterRoom))
app.delete('/api/rooms/enter', checkLogin, jsonParser, wrap(rooms.exitRoom))
app.get('/api/rooms/search', wrap(rooms.search))
app.get('/api/rooms/:roomid/users', checkLogin, wrap(rooms.getUsers))
app.get('/api/user/@me', checkLogin, wrap(user.getUserInfo))
app.post('/api/user/signup', checkLogin, jsonParser, wrap(user.signUp))
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

const server = http.createServer(app)

if (cluster.isMaster) {
  for (let i = 0; i < WORKER_NUM; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker, code, signal) => {
    const s = signal || code
    logger.info(`exit worker #${worker.process.pid} (${s})`)
    cluster.fork()
  })
} else {
  redis.connect()
  redis.client.once('ready', async function connect() {
    logger.info('[redis] connected')
    try {
      await db.connect()

      await init()

      server.listen(PORT, () => {
        logger.info('Listening on', server.address())
      })
    } catch (e) {
      redis.client.emit('error', e)
    }
  })

  redis.client.on('error', function error(e) {
    logger.error(e)
    process.exit(1)
  })
}
