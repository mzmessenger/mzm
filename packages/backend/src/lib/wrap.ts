import { Request, Response, NextFunction } from 'express'
import { StreamWrapResponse } from '../types'

interface WrapFn {
  (req: Request): Promise<object | void>
}

export const wrap = (fn: WrapFn) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      fn(req)
        .then((data) => res.status(200).json(data))
        .catch((e) => next(e))
    } catch (e) {
      next(e)
    }
  }
}

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
