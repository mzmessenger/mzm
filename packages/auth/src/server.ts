import cluster from 'cluster'
import http from 'http'
import { logger } from './lib/logger.js'
import { createMongoClient, sessionClient } from './lib/db.js'
import { WORKER_NUM, PORT } from './config.js'
import { connect as connectRedis } from './lib/redis.js'
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
    const { redis } = await connectRedis()

    await initRemoveConsumerGroup(redis)
    const db = await createMongoClient()

    server = http.createServer(
      createApp({
        db: db,
        sessionClientPromise: sessionClient()
      })
    )
    server.listen(PORT, () => {
      logger.info(`(#${process.pid}) Listening on`, server?.address())
    })

    consume(redis, db)
  }

  main().catch((e) => {
    logger.error(e)
    process.exit(1)
  })
}
