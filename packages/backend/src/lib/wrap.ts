import { Request, Response, NextFunction } from 'express'
import { StreamWrapResponse } from '../types.js'

interface StreamWrapFn {
  (req: Request): StreamWrapResponse
}

export const streamWrap = (fn: StreamWrapFn) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      fn(req)
        .then(({ headers, stream }) => {
          if (headers) {
            res.set(headers)
          }
          stream.pipe(res).on('error', (e) => next(e))
        })
        .catch((e) => next(e))
    } catch (e) {
      next(e)
    }
  }
}
