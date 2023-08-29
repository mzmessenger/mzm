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
  return createHandlerWithContext(path, method, undefined)
}

export function createHandlerWithContext<
  TPath extends string,
  TMethod extends 'get' | 'post' | 'put' | 'delete',
  TContext
>(path: TPath, method: TMethod, context: TContext) {
  return <TReq, TRes>(fn: (req: TReq, context: TContext) => Promise<TRes>) => {
    const handler: WrapFn<TReq, TRes> = (req: TReq) => {
      return fn(req, context)
    }
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
  return createStreamHandlerWithContext(path, method, undefined)
}

export function createStreamHandlerWithContext<
  TPath extends string,
  TMethod extends 'get' | 'post' | 'put' | 'delete',
  TContext
>(path: TPath, method: TMethod, context: TContext) {
  return (fn: (req: Request, context: TContext) => StreamWrapResponse) => {
    const handler: StreamWrapFn = (req) => {
      return fn(req, context)
    }

    return {
      path,
      handler,
      method
    } as const
  }
}
