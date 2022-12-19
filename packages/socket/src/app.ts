import type WebSocket from 'ws'
import { v4 as uuid } from 'uuid'
import { verifyAccessToken } from 'mzm-shared/auth/index'
import { SocketToBackendType, TO_SERVER_CMD } from 'mzm-shared/type/socket'
import { requestSocketAPI } from './lib/req.js'
import { saveSocket, removeSocket } from './lib/sender.js'
import { consume } from './lib/consumer.js'
import logger from './lib/logger.js'
import { JWT } from './config.js'
import { ExtWebSocket } from './types.js'

export const createApp = ({ wss }: { wss: WebSocket.Server }) => {
  consume()

  wss.on('connection', async function connection(ws: ExtWebSocket, req) {
    let userId = null
    let twitterUserName = null
    let githubUserName = null

    const url = new URL(req.url, `http://${req.headers.host}`)
    if (url.searchParams.has('token')) {
      const { err, decoded } = await verifyAccessToken(
        url.searchParams.get('token'),
        JWT.accessTokenSecret,
        {
          issuer: JWT.issuer,
          audience: JWT.audience
        }
      )
      logger.info('[ws:verifyAccessToken]', err, decoded)
      if (!err && decoded) {
        userId = decoded.user._id
        twitterUserName = decoded.user.twitterUserName
        githubUserName = decoded.user.githubUserName
      }
    }
    logger.info('[ws:connection]', userId)

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
      payload: { user: userId, twitterUserName, githubUserName }
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
