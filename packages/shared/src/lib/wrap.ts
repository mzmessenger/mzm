import type { Request, Response, NextFunction } from 'express'

export type WrapFn<TReq = Request, TRes = string | object | void> = {
  (_req: TReq): Promise<TRes>
}

export function response<T>(data: T) {
  return async (req: Request, res: Response) => {
    if (!data) {
      return res.status(200).send('')
    }
    if (typeof data === 'string') {
      return res.status(200).send(data)
    }
    return res.status(200).json(data)
  }
}
