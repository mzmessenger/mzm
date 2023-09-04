/// <reference lib="dom" />
/* eslint-disable @typescript-eslint/ban-types */
import type {
  API,
  HasParamsInPath,
  RouteParams,
  RouteType,
  RouteMethodType
} from 'mzm-shared/src/type/api'
import { compile } from 'path-to-regexp'
import { apis, authApis, TypedFormData } from 'mzm-shared/src/api/universal'
import { API_URL_BASE, AUTH_URL_BASE } from '../constants'
import { proxyRequest, proxyRequestWithFormData } from '../lib/auth'

type QueryOption<T extends RouteType> = T extends {
  request: { query: unknown }
}
  ? { query: ReturnType<T['request']['query']> }
  : {}

type BodyOption<T extends RouteType> = T extends {
  request: { body: unknown }
}
  ? { body: ReturnType<T['request']['body']> }
  : {}

type FormOption<T extends RouteType> = T extends {
  request: { form: unknown }
}
  ? { form: ReturnType<T['request']['form']> }
  : {}

type ClinetOptions<
  T extends string,
  U extends RouteType
> = (HasParamsInPath<T> extends true ? { params: RouteParams<T> } : {}) &
  QueryOption<U> &
  BodyOption<U> &
  FormOption<U>

function createClient<T extends string, U extends RouteType>(
  urlBase: string,
  toPath: (params: RouteParams<T>) => string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
) {
  const client = async (options: ClinetOptions<T, U>) => {
    let path = toPath((options as { params: RouteParams<T> }).params)
    const query =
      (options as unknown as { query: Record<string, string> }).query ?? {}
    if (Object.keys(query).length > 0) {
      const init = Object.entries(query).reduce((prev, [key, value]) => {
        return [...prev, [key, value]]
      }, [])

      const q = new URLSearchParams(init)
      path += `?${q.toString()}`
    }

    const url = urlBase + path

    const form = (options as { form?: { [key: string]: string | Blob } }).form
    if (form) {
      const init: Parameters<typeof proxyRequestWithFormData>[1] = {
        body: Object.entries(form).map(([key, value]) => [key, value])
      }
      return await proxyRequestWithFormData(url, init)
    }

    const init: Parameters<typeof proxyRequest>[1] = {
      method
    }

    const body = (options as { body?: unknown }).body
    if (body) {
      init.body = typeof body === 'string' ? body : JSON.stringify(body)
    }
    return await proxyRequest(url, init)
  }
  return { client }
}

function createRouteClients<T extends string, U extends RouteMethodType>(
  urlBase: string,
  path: T,
  routes: U
) {
  const toPath = compile(path)
  const clients: {
    [key in keyof RouteMethodType]: ReturnType<typeof createClient<T, U[key]>>
  } = {}

  for (const method of ['GET', 'POST', 'PUT', 'DELETE'] as const) {
    if (routes[method]) {
      clients[method] = createClient(urlBase, toPath, method)
    }
  }

  return clients as (U extends { GET: unknown }
    ? { GET: Exclude<(typeof clients)['GET'], undefined> }
    : {}) &
    (U extends { POST: unknown }
      ? { POST: Exclude<(typeof clients)['POST'], undefined> }
      : {}) &
    (U extends { PUT: unknown }
      ? { PUT: Exclude<(typeof clients)['PUT'], undefined> }
      : {}) &
    (U extends { DELETE: unknown }
      ? { DELETE: Exclude<(typeof clients)['DELETE'], undefined> }
      : {})
}

function createAllClients(
  base: typeof authApis,
  urlBase: string
): {
  [key in keyof typeof authApis]: ReturnType<
    typeof createRouteClients<key, (typeof authApis)[key]>
  >
}
function createAllClients(
  base: typeof apis,
  urlBase: string
): {
  [key in keyof typeof apis]: ReturnType<
    typeof createRouteClients<key, (typeof apis)[key]>
  >
}
function createAllClients(
  base: typeof apis | typeof authApis,
  urlBase: string
) {
  const clients: { [key: string]: ReturnType<typeof createRouteClients> } = {}

  for (const path of Object.keys(base)) {
    const routes = base[path as keyof typeof base]
    clients[path] = createRouteClients(urlBase, path, routes)
  }

  return clients
}

export const clients = createAllClients(apis, API_URL_BASE)
export const authClients = createAllClients(authApis, AUTH_URL_BASE)

type UploadRoomIcon = API['/api/icon/rooms/:roomName']
export const uploadRoomIcon = async (
  params: UploadRoomIcon['params'],
  blob: Blob
) => {
  const res = await clients['/api/icon/rooms/:roomName']['POST'].client({
    params,
    form: { icon: blob }
  })

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
  const res = await clients['/api/icon/user']['POST'].client({
    form: { icon: blob }
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
