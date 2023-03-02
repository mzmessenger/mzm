import cluster from 'cluster'
import { WebSocketServer } from 'ws'
import { WORKER_NUM, PORT } from './config.js'
import { logger } from './lib/logger.js'
import { connect } from './lib/redis.js'
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
  let server: WebSocketServer | null = null

  process.on('SIGTERM', (signal) => {
    logger.info(signal)
    if (!server) {
      process.exit(0)
    }
    server.clients.forEach((ws) => {
      ws.terminate()
    })
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
    await connect()

    server = new WebSocketServer(
      {
        port: PORT
      },
      () => {
        logger.info(`(#${process.pid}) Listening on`, server.address())
      }
    )
    createApp({ wss: server })
  }

  main().catch((e) => {
    logger.error(e)
    process.exit(1)
  })
}
