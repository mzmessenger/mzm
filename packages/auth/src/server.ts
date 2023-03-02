import cluster from 'cluster'
import http from 'http'
import { logger } from './lib/logger.js'
import { connect } from './lib/db.js'
import { WORKER_NUM, PORT } from './config.js'
import * as redis from './lib/redis.js'
import { initRemoveConsumerGroup, consume } from './lib/consumer.js'
import { createApp } from './app.js'

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

  const main = async () => {
    await redis.connect()

    await initRemoveConsumerGroup()
    await connect()

    server = http.createServer(createApp({ client: redis.sessionRedis }))
    server.listen(PORT, () => {
      logger.info(`(#${process.pid}) Listening on`, server.address())
    })

    consume()
  }

  main().catch((e) => {
    logger.error(e)
    process.exit(1)
  })
}
