import cluster from 'cluster'
import WebSocket from 'ws'
import { v4 as uuid } from 'uuid'
import { WORKER_NUM, SOCKET_LISTEN } from './config'
import logger from './lib/logger'
import redis from './lib/redis'
import { requestSocketAPI } from './lib/req'
import { saveSocket, removeSocket } from './lib/sender'
import { consume } from './lib/consumer'
import { ExtWebSocket } from './types'

type PostData = {
  cmd: 'socket:connection'
  payload: { user: string; twitterUserName: string }
}

if (cluster.isPrimary) {
  for (let i = 0; i < WORKER_NUM; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker, code, signal) => {
    const s = signal || code
    logger.info(`exit worker #${worker.process.pid} (${s})`)
    cluster.fork()
  })
} else {
  redis
    .on('ready', async () => {
      const wss = new WebSocket.Server(
        {
          port: SOCKET_LISTEN
        },
        () => {
          logger.info('Listening on', SOCKET_LISTEN)
        }
      )

      consume()

      wss.on('connection', async function connection(ws: ExtWebSocket, req) {
        const user: string = req.headers['x-user-id'] as string
        if (!user) {
          ws.close()
          return
        }
        const id = uuid()
        ws.id = id
        saveSocket(id, user, ws)
        const twitterUserName = req.headers['x-twitter-user-name'] as string

        const data: PostData = {
          cmd: 'socket:connection',
          payload: { user, twitterUserName }
        }
        requestSocketAPI(JSON.stringify(data), user, id)
          .then(({ body }) => {
            if (body) {
              ws.send(body)
            }
          })
          .catch((e) => {
            logger.error('[post:error]', e)
          })

        ws.on('message', async function incoming(data) {
          const message = data.toString()
          if (message === 'pong') {
            return
          }
          try {
            const res = await requestSocketAPI(message, user, id)
            if (res.body) {
              ws.send(res.body)
            }
          } catch (e) {
            logger.error('[post:error]', e)
          }
        })

        ws.on('close', function close() {
          logger.info('closed:', user, ws.id)
          removeSocket(ws.id, user)
        })

        ws.on('error', function error(e) {
          logger.error('error: ', e)
        })
      })

      setInterval(() => {
        wss.clients.forEach((ws) => {
          ws.send('ping')
        })
      }, 50000)
    })
    .on('error', (e) => {
      logger.error(e)
    })
}
