import type { MongoClient } from 'mongodb'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createErrorHandler } from 'mzm-shared/src/lib/middleware'
import { CORS_ORIGIN } from './config.js'
import { logger } from './lib/logger.js'
import {
  getRequestUserId,
  getRequestGithubUserName,
  getRequestTwitterUserName
} from './lib/utils.js'
import { addUserResponse, closeUserResponse } from './lib/fetchStreaming.js'
import { response } from 'mzm-shared/src/lib/wrap'
import * as rooms from './handlers/rooms/index.js'
import * as user from './handlers/users.js'
import * as icon from './handlers/icon/index.js'
import { connection } from './handlers/socket/connection.js'
import { checkAccessToken, checkQueueSecret } from './middleware/index.js'
import { handleQueueEvent } from './lib/consumer/index.js'
import { GATEWAY_ORIGIN_SECRET } from './config.js'
import { acknowledgeOutbox, claimOutbox, outboxState, releaseOutbox } from './lib/outbox.js'
import { executeSocketOperation } from './handlers/socketOperation.js'
import { socketIdempotencyKey } from './lib/idempotency.js'

const jsonParser = express.json({ limit: '1mb' })

export function createApp({ db }: { db: MongoClient }) {
  const app = express()
  app.use(helmet())
  app.use(
    cors({
      origin: CORS_ORIGIN
    })
  )

  rooms.createRoute(app, { db, jsonParser, checkAccessToken })
  user.createRoute(app, { db, jsonParser, checkAccessToken })
  icon.createRoute(app, { db, checkAccessToken })

  app.use('/internal/outbox/v1', (req, res, next) => {
    if (!GATEWAY_ORIGIN_SECRET || req.headers['x-mzm-gateway-authorization'] !== `Bearer ${GATEWAY_ORIGIN_SECRET}`) {
      res.status(401).send('unauthorized')
      return
    }
    next()
  })
  app.post('/internal/outbox/v1/claim', jsonParser, async (req, res) => {
    const { owner, operationId, limit } = req.body
    if (typeof owner !== 'string' || (operationId !== undefined && typeof operationId !== 'string') || !Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).send('invalid claim')
    return res.json(await claimOutbox({ db, owner, operationId, limit }))
  })
  app.post('/internal/outbox/v1/ack', jsonParser, async (req, res) => {
    const { owner, events } = req.body
    if (typeof owner !== 'string' || !Array.isArray(events) || !events.every((event) => event && typeof event === 'object' && typeof event.eventId === 'string' && Number.isInteger(event.eventIndex))) return res.status(400).send('invalid acknowledgement')
    return res.sendStatus((await acknowledgeOutbox({ db, owner, events })) ? 204 : 409)
  })
  app.post('/internal/outbox/v1/release', jsonParser, async (req, res) => {
    const { owner, events } = req.body
    if (typeof owner !== 'string' || !Array.isArray(events) || !events.every((event) => event && typeof event === 'object' && typeof event.eventId === 'string' && Number.isInteger(event.eventIndex))) return res.status(400).send('invalid release')
    return res.sendStatus((await releaseOutbox({ db, owner, events })) ? 204 : 409)
  })
  app.post('/internal/outbox/v1/state', jsonParser, async (req, res) => {
    if (typeof req.body?.operationId !== 'string') return res.status(400).send('invalid operation')
    return res.json(await outboxState(db, req.body.operationId))
  })

  app.post(
    '/internal/queue',
    checkQueueSecret,
    jsonParser,
    async (req, res) => {
      await handleQueueEvent({ db, event: req.body })
      res.status(204).send()
    }
  )

  app.get('/api/socket', checkAccessToken, (req, res) => {
    const user = getRequestUserId(req)

    addUserResponse(user, res)

    res.on('close', () => {
      closeUserResponse(user, res)
    })

    res.status(200)
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache'
    })
    res.flushHeaders()

    const twitterUserName = getRequestTwitterUserName(req)
    const githubUserName = getRequestGithubUserName(req)
    logger.info('mzm:socket:connection', {
      user,
      twitterUserName,
      githubUserName
    })
    connection(db, user, {
      twitterUserName,
      githubUserName
    }).then((r) => {
      logger.info('mzm:socket:connection:response', r)
      res.write(Buffer.from(JSON.stringify(r)))
      res.write('\0')
    })

    setInterval(() => {
      res.write('ping')
      res.write(Buffer.from('\0'))
    }, 5000)
  })

  app.post('/api/socket', checkAccessToken, jsonParser, async (req, res) => {
    const user = getRequestUserId(req)
    const key = socketIdempotencyKey(req.headers['idempotency-key'])
    const operation = await executeSocketOperation({ db, subject: user, idempotencyKey: key, data: req.body })
    res.set('x-mzm-operation-id', operation.operationId)
    return response(operation.response)(req, res)
  })

  app.use(createErrorHandler(logger))

  return app
}
