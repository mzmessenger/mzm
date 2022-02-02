import cluster from 'cluster'
import WebSocket from 'ws'
import { once } from 'events'
import { WORKER_NUM, PORT } from './config'
import logger from './lib/logger'
import redis from './lib/redis'
import { createApp } from './app'

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

    logger.info('[redis] connected')

    await once(redis, 'ready')

    const wss = new WebSocket.Server(
      {
        port: PORT
      },
      () => {
        logger.info('Listening on', PORT)
      }
    )
    createApp({ wss })
  }

  main().catch((e) => {
    logger.error(e)
    process.exit(1)
  })
}
