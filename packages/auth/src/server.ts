import cluster from 'cluster'
import http from 'http'
import { once } from 'events'
import { logger } from './lib/logger'
import { connect } from './lib/db'
import { redis, sessionRedis } from './lib/redis'
import { createApp } from './app'
import { WORKER_NUM, PORT } from './config'
import { initRemoveConsumerGroup, consume } from './lib/consumer'

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
    redis.on('error', (e) => {
      logger.error(e)
      process.exit(1)
    })

    sessionRedis.on('error', (e) => {
      logger.error(e)
      process.exit(1)
    })

    await Promise.all([once(redis, 'ready'), once(sessionRedis, 'ready')])

    logger.info('[redis] connected')

    await initRemoveConsumerGroup()
    await connect()

    const server = http.createServer(createApp({ client: sessionRedis }))
    server.listen(PORT, () => {
      logger.info('Listening on', server.address())
    })

    consume()
  }

  main().catch((e) => {
    logger.error(e)
    process.exit(1)
  })
}
