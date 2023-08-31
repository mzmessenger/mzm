import type { Request, Response, NextFunction } from 'express'

export type WrapFn<TReq = Request, TRes = string | object | void> = {
  (_req: TReq): Promise<TRes>
}

export const wrap = <Req>(fn: WrapFn<Req>) => {
  return (req: unknown, res: Response, next: NextFunction) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return fn(req as any)
        .then((data) => {
          if (!data) {
            return res.status(200).send('')
          }
          if (typeof data === 'string') {
            return res.status(200).send(data)
          }
          res.status(200).json(data)
        })
        .catch((e) => next(e))
    } catch (e) {
      next(e)
    }
  }
}
