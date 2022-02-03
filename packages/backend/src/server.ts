import cluster from 'cluster'
import http from 'http'
import { once } from 'events'
import schedule from 'node-schedule'

import { WORKER_NUM, PORT } from './config'
import { logger } from './lib/logger'
import * as redis from './lib/redis'
import * as db from './lib/db'
import { init } from './logic/server'
import { addSyncSearchRoomQueue } from './lib/provider'
import { createApp } from './app'

schedule.scheduleJob({ minute: 0 }, () => {
  try {
    addSyncSearchRoomQueue()
  } catch (e) {
    logger.error(e)
  }
})

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
  const main = async () => {
    redis.connect()

    redis.client.on('error', function error(e) {
      logger.error(e)
      process.exit(1)
    })

    await once(redis.client, 'ready')

    logger.info('[redis] connected')

    await db.connect()

    await init()

    const app = createApp()
    const server = http.createServer(app)

    server.listen(PORT, () => {
      logger.info('Listening on', server.address())
    })
  }

  main().catch((e) => {
    logger.error(e)
    process.exit(1)
  })
}
