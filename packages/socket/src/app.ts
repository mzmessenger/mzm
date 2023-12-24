import type WebSocket from 'ws'
import { verifyAccessToken } from 'mzm-shared/src/auth/index'
import { randomUUID } from 'crypto'
import { SocketToBackendType, TO_SERVER_CMD } from 'mzm-shared/src/type/socket'
import { requestSocketAPI } from './lib/req.js'
import { saveSocket, removeSocket } from './lib/sender.js'
import { consume } from './lib/consumer.js'
import { logger } from './lib/logger.js'
import { JWT } from './config.js'
import { ExtWebSocket } from './types.js'

export const createApp = ({ wss }: { wss: WebSocket.Server }) => {
  consume()

  wss.on('connection', async function connection(ws: ExtWebSocket, req) {
    let userId: string | null = null

    if (!req.url) {
      return
    }
    const url = new URL(req.url, `http://${req.headers.host}`)
    const token = url.searchParams.get('token')
    if (token) {
      const { err, decoded } = await verifyAccessToken(
        token,
        JWT.accessTokenSecret,
        {
          issuer: JWT.issuer,
          audience: JWT.audience
        }
      )
      logger.info({
        label: 'ws:verifyAccessToken',
        err,
        decoded
      })
      if (!err && decoded) {
        userId = decoded.user._id
      }
    }
    logger.info({
      label: 'ws:connection',
      userId
    })

    if (!userId) {
      ws.close()
      return
    }

    const id = randomUUID()
    ws.id = id
    saveSocket(id, userId, ws)

    ws.on('message', async function incoming(data) {
      const message = data.toString()
      logger.info({
        label: 'ws:message',
        userId,
        id,
        message
      })
      if (message === 'pong') {
        return
      }
      if (!userId) {
        return
      }
      try {
        const res = await requestSocketAPI(message, userId, id)
        if (res.body) {
          ws.send(res.body)
          logger.info({
            label: 'ws:send',
            userId,
            id,
            body: res.body
          })
        }
      } catch (e) {
        logger.error({
          label: 'post:error',
          err: e
        })
      }
    })

    ws.on('close', function close() {
      if (!userId) {
        return
      }
      logger.info('ws:closed', userId, ws.id)
      removeSocket(ws.id, userId)
    })

    ws.on('error', function error(e) {
      logger.error({
        label: 'ws:error',
        err: e
      })
    })

    const data: SocketToBackendType = {
      cmd: TO_SERVER_CMD.CONNECTION
    }

    requestSocketAPI(JSON.stringify(data), userId, id)
      .then(({ body }) => {
        if (body) {
          ws.send(body)
        }
      })
      .catch((e) => {
        logger.error({
          label: 'post:error',
          err: e
        })
      })
  })

  setInterval(() => {
    wss.clients.forEach((ws) => {
      ws.send('ping')
    })
  }, 50000)
}
