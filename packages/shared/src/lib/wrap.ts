import type { Request, Response } from 'express'

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
