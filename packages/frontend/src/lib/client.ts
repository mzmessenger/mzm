import type {
  API,
  AuthAPI,
  HasParamsInPath,
  RouteParams
} from 'mzm-shared/src/type/api'
import { compile } from 'path-to-regexp'
import { apis } from 'mzm-shared/src/api/universal'
import { API_URL_BASE, AUTH_URL_BASE } from '../constants'
import { proxyRequest, proxyRequestWithFormData } from '../lib/auth'

function createKeyData<T extends typeof apis>(routes: T) {
  return Object.keys(routes).reduce(
    (prev, key) => {
      const toPath = compile(key)
      return { ...prev, [key]: { toPath } }
    },
    {} as {
      [key in keyof T]: {
        toPath: HasParamsInPath<key> extends true
          ? (params: RouteParams<key>) => string
          : () => string
      }
    }
  )
}
const apisKeyData = createKeyData(apis)

type Init = Parameters<typeof proxyRequest>[1]

type Options = {
  headers?: Record<string, string>
  body?: Init['body']
}

type Parser<T> = (res: Awaited<ReturnType<typeof proxyRequest>>) => Promise<T>

const apiClient = async <T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  options: Options,
  parser: Parser<T>
) => {
  const headers = {
    ...options.headers
  }

  const init: Init = {
    method,
    headers
  }

  if (options.headers) {
    init.headers = options.headers
  }

  if (options.body) {
    init.body = options.body
  }
  const res = await proxyRequest(url, init)

  return await parser(res)
}

export const createAuthApiClient = async <
  P extends keyof AuthAPI,
  M extends 'GET' | 'POST' | 'PUT' | 'DELETE',
  T
>(
  path: P,
  method: M,
  createOptions: (arg: {
    path: P
    method: M
    toPath: () => P
  }) => { path: string } & Options,
  parser: Parser<T>
) => {
  const options = createOptions({
    path,
    method,
    toPath: () => {
      return path
    }
  })
  return apiClient<T>(AUTH_URL_BASE + options.path, method, options, parser)
}

export const createApiClient = async <
  P extends keyof API,
  M extends 'GET' | 'POST' | 'PUT' | 'DELETE',
  T
>(
  path: P,
  method: M,
  createOptions: (arg: {
    path: P
    method: M
    toPath: (typeof apisKeyData)[P]['toPath']
  }) => { path: string } & Options,
  parser: Parser<T>
) => {
  const keyData = apisKeyData[path]
  const options = createOptions({ path, method, toPath: keyData.toPath })
  return apiClient<T>(API_URL_BASE + options.path, method, options, parser)
}

type UploadRoomIcon = API['/api/icon/rooms/:roomName']
export const uploadRoomIcon = async (
  params: UploadRoomIcon['params'],
  blob: Blob
) => {
  const res = await proxyRequestWithFormData(
    API_URL_BASE + `/api/icon/rooms/${params.roomName}`,
    {
      body: [['icon', blob]]
    }
  )

  if (res.ok) {
    const body = res.body as UploadRoomIcon['POST']['response'][200]['body']
    return {
      ...res,
      ok: true,
      body: body
    }
  }

  return res
}

type UploadUserIcon = API['/api/icon/user']

export const uploadUserIcon = async (blob: Blob) => {
  const res = await proxyRequestWithFormData(API_URL_BASE + '/api/icon/user', {
    body: [['icon', blob]]
  })

  if (res.ok) {
    const body = res.body as UploadUserIcon['POST']['response'][200]['body']
    return {
      ...res,
      body
    }
  }

  return res
}
