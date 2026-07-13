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
import { type EventPublisher } from './lib/queue.js'
import { addUserResponse, closeUserResponse } from './lib/fetchStreaming.js'
import { response } from 'mzm-shared/src/lib/wrap'
import * as rooms from './handlers/rooms/index.js'
import * as user from './handlers/users.js'
import * as icon from './handlers/icon/index.js'
import * as internal from './handlers/internal.js'
import { connection } from './handlers/socket/connection.js'
import { checkAccessToken, checkQueueSecret } from './middleware/index.js'
import { handleQueueEvent } from './lib/consumer/index.js'

const jsonParser = express.json({ limit: '1mb' })

export function createApp({
  db,
  publisher
}: {
  db: MongoClient
  publisher: EventPublisher
}) {
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

  app.post(
    '/internal/queue',
    checkQueueSecret,
    jsonParser,
    async (req, res) => {
      await handleQueueEvent({ db, publisher, event: req.body })
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
    const data = await internal.socket(req, { db, redis: publisher })
    return response(data)(req, res)
  })

  app.use(createErrorHandler(logger))

  return app
}
