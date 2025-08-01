import cluster from 'cluster'
import http from 'http'
import schedule from 'node-schedule'

import { WORKER_NUM, PORT, redis } from './config.js'
import { logger } from './lib/logger.js'
import { connect } from './lib/redis.js'
import { initMongoClient } from './lib/db.js'
import { init } from './logic/server.js'
import { addSyncSearchRoomQueue } from './lib/provider/index.js'
import { createApp } from './app.js'

async function main() {
  const redisClient = await connect(redis.options)

  schedule.scheduleJob('0 * * * *', () => {
    try {
      addSyncSearchRoomQueue(redisClient)
    } catch (e) {
      logger.error(e)
    }
  })

  const db = await initMongoClient()

  await init({ db, redis: redisClient })

  const app = createApp({ db, redis: redisClient })
  const server = http.createServer(app)

  server.listen(PORT, () => {
    logger.info(`(#${process.pid}) Listening on`, server?.address())
  })

  return server
}

if (WORKER_NUM > 1 && cluster.isPrimary) {
  for (let i = 0; i < WORKER_NUM; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker, code, signal) => {
    const s = signal || code
    logger.info(`exit worker #${worker.process.pid} (${s})`)
    cluster.fork()
  })
} else {
  let server: http.Server | null = null

  process.on('SIGTERM', (signal) => {
    logger.info(signal)
    if (!server) {
      process.exit(0)
    }
    server.close((err) => {
      if (err) {
        logger.error('[gracefulShutdown]', err)
        return process.exit(1)
      }
      logger.error('[gracefulShutdown]', 'exit')
      process.exit(0)
    })

    setTimeout(() => {
      logger.error('[gracefulShutdown]', 'timeout')
      process.exit(1)
    }, 20000)
  })

  main()
    .then((s) => (server = s))
    .catch((e) => {
      logger.error(e)
      process.exit(1)
    })
}
