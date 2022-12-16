import type { IncomingHttpHeaders } from 'http'
import type { AccessToken } from '../type/auth.js'
import jwt from 'jsonwebtoken'
import { request } from 'undici'
import { HEADERS } from './constants.js'

type RequestOptions = {
  url: string
  headers: {
    cookie: IncomingHttpHeaders['cookie']
  }
  bodyTimeout?: number
  headersTimeout?: number
}
export const requestAuthServer = async (options: RequestOptions) => {
  const { headers } = await request(`${options.url}/auth`, {
    method: 'GET',
    headers: {
      cookie: options.headers.cookie
    },
    bodyTimeout: options.bodyTimeout ?? 1000 * 60 * 5,
    headersTimeout: options.headersTimeout ?? 1000 * 60 * 5
  })

  const userId = headers[HEADERS.USER_ID] as string
  const twitterUserName = headers[HEADERS.TIWTTER_USER_NAME] as string
  const githubUserName = headers[HEADERS.GITHUB_USER_NAME] as string

  return { userId, twitterUserName, githubUserName }
}

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
