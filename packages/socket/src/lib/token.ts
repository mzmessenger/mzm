import type { InternalAccessToken } from 'mzm-shared/type/auth'
import jwt from 'jsonwebtoken'
import { JWT } from '../config.js'

export const createInternalAccessToken = () => {
  return new Promise<string>((resolve, reject) => {
    const payload: InternalAccessToken = {
      name: 'socket-to-api'
    }

    jwt.sign(
      payload,
      JWT.internalAccessTokenSecret,
      {
        expiresIn: '5m',
        algorithm: 'HS256',
        issuer: JWT.issuer,
        subject: 'internal access token',
        audience: JWT.audience
      },
      (err, token) => {
        if (err) {
          return reject(err)
        }
        if (!token) {
          return reject('no token')
        }
        resolve(token)
      }
    )
  })
}
