import type WebSocket from 'ws'
import { v4 as uuid } from 'uuid'
import { requestAuthServer } from 'mzm-shared/auth'
import { SocketToBackendType, TO_SERVER_CMD } from 'mzm-shared/type/socket'
import { requestSocketAPI } from './lib/req'
import { saveSocket, removeSocket } from './lib/sender'
import { consume } from './lib/consumer'
import logger from './lib/logger'
import { AUTH_SERVER } from './config'
import { ExtWebSocket } from './types'

export const createApp = ({ wss }: { wss: WebSocket.Server }) => {
  consume()

  wss.on('connection', async function connection(ws: ExtWebSocket, req) {
    const { userId, twitterUserName } = await requestAuthServer({
      url: AUTH_SERVER,
      headers: {
        cookie: req.headers.cookie
      }
    })

    if (!userId) {
      ws.close()
      return
    }

    const id = uuid()
    ws.id = id
    saveSocket(id, userId, ws)

    ws.on('message', async function incoming(data) {
      const message = data.toString()
      logger.info('[ws:message]', userId, id, message)
      if (message === 'pong') {
        return
      }
      try {
        const res = await requestSocketAPI(message, userId, id)
        if (res.body) {
          ws.send(res.body)
          logger.info('[ws:send]', userId, id, res.body)
        }
      } catch (e) {
        logger.error('[post:error]', e)
      }
    })

    ws.on('close', function close() {
      logger.info('closed:', userId, ws.id)
      removeSocket(ws.id, userId)
    })

    ws.on('error', function error(e) {
      logger.error('error: ', e)
    })

    const data: SocketToBackendType = {
      cmd: TO_SERVER_CMD.CONNECTION,
      payload: { user: userId, twitterUserName }
    }

    requestSocketAPI(JSON.stringify(data), userId, id)
      .then(({ body }) => {
        if (body) {
          ws.send(body)
        }
      })
      .catch((e) => {
        logger.error('[post:error]', e)
      })
  })

  setInterval(() => {
    wss.clients.forEach((ws) => {
      ws.send('ping')
    })
  }, 50000)
}
