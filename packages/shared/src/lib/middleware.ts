import type { Request, Response, NextFunction } from 'express'
import { isHttpError } from './errors.js'

type Logger = {
  error: (..._args: unknown[]) => void
}

export const createErrorHandler = (logger: Logger) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (isHttpError(err)) {
      res.status(err.status).send(err.toResponse())
      return
    }
    res.status(500).send('Internal Server Error')
    logger.error('[Internal Server Error]', err)
  }
}
