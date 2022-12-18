import type { Request } from 'express'
import type { AccessToken } from '../type/auth.js'
import jwt from 'jsonwebtoken'

type VeryfyAccessToken =
  | {
      err: jwt.VerifyErrors
      decoded: null
    }
  | {
      err: null
      decoded: AccessToken
    }

const verifyAccessTokenAsync = (
  accessToken: string,
  accessTokenSecret: string
) => {
  return new Promise<VeryfyAccessToken>((resolve) => {
    jwt.verify(
      accessToken,
      accessTokenSecret,
      {
        algorithms: ['HS256']
      },
      (err, decoded) => {
        if (err) {
          return resolve({ err, decoded: null })
        }
        return resolve({
          err: null,
          decoded: decoded as AccessToken
        })
      }
    )
  })
}

export const verifyAccessToken = async (
  accessToken: string,
  accessTokenSecret: string
): Promise<
  | {
      err: jwt.VerifyErrors
      decoded: null
    }
  | {
      err: null
      decoded: AccessToken
    }
> => {
  const { err, decoded } = await verifyAccessTokenAsync(
    accessToken,
    accessTokenSecret
  )

  if (err) {
    return {
      err,
      decoded: null
    }
  }
  return { err: null, decoded }
}

export const parseAuthorizationHeader = (req: Request) => {
  const authorizationHeaderKey = Object.prototype.hasOwnProperty.call(
    req.headers,
    'Authorization'
  )
    ? 'Authorization'
    : 'authorization'
  const authorization = req.headers[authorizationHeaderKey] as string
  if (!authorization) {
    return null
  }

  const [, credentials] = authorization.split(' ')
  const token = (credentials ?? '').trim()
  return token !== '' ? token : null
}
