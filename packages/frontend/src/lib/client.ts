import { API_URL_BASE } from '../constants'
import { proxyRequest } from '../lib/auth'

type Init = Parameters<typeof proxyRequest>[1]

type Options = {
  accessToken?: string // @todo remove
  headers?: Record<string, string>
} & (
  | {
      method?: 'GET'
    }
  | {
      method: 'POST' | 'PUT' | 'DELETE'
      accessToken?: string // @todo remove
      body?: Init['body']
    }
)

export const createApiClient = async <T>(
  path: string,
  options: Options,
  parser: (res: Awaited<ReturnType<typeof proxyRequest>>) => Promise<T>
) => {
  const headers = {
    ...options.headers
  }

  const method = options.method ?? 'GET'

  const init: Init = {
    method,
    headers,
    ...options
  }

  if (
    (options.method === 'POST' ||
      options.method === 'PUT' ||
      options.method === 'DELETE') &&
    options.body
  ) {
    init.body = options.body
  }
  const res = await proxyRequest(API_URL_BASE + path, init)

  return await parser(res)
}
