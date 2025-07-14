import type { InternalAccessToken } from 'mzm-shared/src/type/auth'

import jwt from 'jsonwebtoken'

import { JWT } from '../config.js'

type VeryfyInternalAccessToken =
  | {
      err: jwt.VerifyErrors
      decoded: null
    }
  | {
      err: null
      decoded: InternalAccessToken
    }

export const verifyInternalAccessToken = (token: string) => {
  return new Promise<VeryfyInternalAccessToken>((resolve) => {
    jwt.verify(
      token,
      JWT.internalAccessTokenSecret,
      JWT.verifyOptions,
      (err, decoded) => {
        if (err) {
          return resolve({ err, decoded: null })
        }
        return resolve({
          err: null,
          decoded: decoded as InternalAccessToken
        })
      }
    )
  })
}
