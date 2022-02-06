import type { IncomingHttpHeaders } from 'http'
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
