import type { Request, Response, NextFunction } from 'express'
import type { WrapFn } from 'mzm-shared/src/lib/wrap'
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
  TMethod extends 'GET' | 'POST' | 'PUT' | 'DELETE',
  TContext
>(
  path: TPath,
  method: TMethod,
  context: (arg: { path: TPath; method: TMethod }) => TContext
) {
  return <TReq extends Request, TRes>(
    fn: (req: TReq, context: TContext) => Promise<TRes>
  ) => {
    const handler: WrapFn<TReq, TRes> = (req: TReq) => {
      return fn(req, context({ path, method }))
    }
    return {
      path,
      handler,
      method: method.toLowerCase() as Lowercase<TMethod>
    } as const
  }
}

export function createStreamHandler<
  TPath extends string,
  TMethod extends 'GET' | 'POST' | 'PUT' | 'DELETE',
  TContext
>(
  path: TPath,
  method: TMethod,
  context: (arg: { path: TPath; method: TMethod }) => TContext
) {
  return (fn: (req: Request, context: TContext) => StreamWrapResponse) => {
    const handler: StreamWrapFn = (req) => {
      return fn(req, context({ path, method }))
    }

    return {
      path,
      handler,
      method: method.toLowerCase() as Lowercase<TMethod>
    } as const
  }
}
