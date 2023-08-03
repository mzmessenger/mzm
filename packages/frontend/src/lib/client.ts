import type { RESPONSE } from 'mzm-shared/type/api'
import { API_URL_BASE } from '../constants'
import { proxyRequest, proxyRequestWithFormData } from '../lib/auth'

type Init = Parameters<typeof proxyRequest>[1]

type Options = {
  headers?: Record<string, string>
} & (
  | {
      method?: 'GET'
    }
  | {
      method: 'POST' | 'PUT' | 'DELETE'
      body?: Init['body']
    }
)

type Parser<T> = (res: Awaited<ReturnType<typeof proxyRequest>>) => Promise<T>

export const createApiClient = async <T>(
  path: string,
  options: Options,
  parser: Parser<T>
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

export const uploadRoomIcon = async (name: string, blob: Blob) => {
  const res = await proxyRequestWithFormData(
    API_URL_BASE + `/api/icon/rooms/${name}`,
    {
      body: [['icon', blob]]
    }
  )

  if (res.ok) {
    const body = res.body as RESPONSE['/api/icon/rooms/:roomname']['POST']
    return {
      ...res,
      ok: true,
      body: body
    }
  }

  return res
}

export const uploadUserIcon = async (blob: Blob) => {
  const res = await proxyRequestWithFormData(API_URL_BASE + '/api/icon/user', {
    body: [['icon', blob]]
  })

  if (res.ok) {
    const body = res.body as RESPONSE['/api/icon/user']['POST']
    return {
      ...res,
      body
    }
  }

  return res
}
