import type { Request, Response, NextFunction } from 'express'
import type { WrapFn } from 'mzm-shared/lib/wrap'
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

export function createHandler<
  TPath extends string,
  TMethod extends 'get' | 'post' | 'put' | 'delete'
>(path: TPath, method: TMethod) {
  return <TReq, TRes>(handler: WrapFn<TReq, TRes>) => {
    return {
      path,
      handler,
      method
    } as const
  }
}

export function createStreamHandler<
  TPath extends string,
  TMethod extends 'get' | 'post' | 'put' | 'delete'
>(path: TPath, method: TMethod) {
  return (handler: StreamWrapFn) => {
    return {
      path,
      handler,
      method
    } as const
  }
}
