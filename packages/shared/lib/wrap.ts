import type { Request, Response, NextFunction } from 'express'

export type WrapFn<Res = unknown> = {
  (_req: Request): Promise<Res>
}

export const wrap = <T>(fn: WrapFn<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      return fn(req)
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
