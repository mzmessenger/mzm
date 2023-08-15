import type { Request, Response, NextFunction } from 'express'
import { randomBytes } from 'node:crypto'

export type NonceResponse = Response<unknown, { nonce: string }>

export const createNonceMiddleware = (
  req: Request,
  res: NonceResponse,
  next: NextFunction
) => {
  const nonce = randomBytes(16).toString('hex')
  res.locals.nonce = nonce
  next()
}
