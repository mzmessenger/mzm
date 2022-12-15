import type { IncomingHttpHeaders } from 'http'
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { request } from 'undici'

export const HEADERS = {
  USER_ID: 'x-user-id',
  TIWTTER_USER_NAME: 'x-twitter-user-name',
  GITHUB_USER_NAME: 'x-github-user-name'
} as const

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
      err: unknown
      decoded: null
    }
  | {
      err: null
      decoded: { user: { _id: string } }
    }

const veryfyAccessToken = (accessToken: string, accessTokenSecret: string) => {
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
          // @todo type
          decoded: decoded as { user: { _id: string } }
        })
      }
    )
  })
}

export const checkJwt = async (
  accessToken: string,
  accessTokenSecret: string
): Promise<
  | {
      err: {
        status: number
        message: string
      }
      decoded: null
    }
  | {
      err: null
      decoded: { user: { _id: string } }
    }
> => {
  const { err, decoded } = await veryfyAccessToken(
    accessToken,
    accessTokenSecret
  )

  if (err) {
    return {
      err: { status: 402, message: 'token expired' },
      decoded: null
    }
  }
  return { err: null, decoded }
}
