/* eslint-disable @typescript-eslint/ban-types */
import type {
  HasParamsInPath,
  RouteParams,
  RouteType,
  RouteMethodType,
  DefinedType,
  HttpStatus
} from 'mzm-shared/src/type/api'
import { compile } from 'path-to-regexp'
import { apis, authApis } from 'mzm-shared/src/api/universal'
import { API_URL_BASE, AUTH_URL_BASE } from '../constants'
import { proxyRequest, proxyRequestWithFormData } from '../lib/auth'

type ClinetOptions<
  T extends string,
  U extends RouteType
> = (HasParamsInPath<T> extends true ? { params: RouteParams<T> } : {}) & {
  [key in keyof U['request']]: ReturnType<U['request'][key]>
}

type Response<
  TRouteTypeResponse extends RouteType['response'],
  TStatus = HttpStatus
> = TStatus extends keyof RouteType['response']
  ? {
      ok: TStatus extends 200 ? true : false
      status: TStatus
      body: DefinedType<TRouteTypeResponse[TStatus]['body']>
    }
  : {
      ok: boolean
      status: number
      body: unknown
    }

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
      const res = await proxyRequestWithFormData(url, init)
      return res as Response<U['response']>
    }

    const init: Parameters<typeof proxyRequest>[1] = {
      method
    }

    const body = (options as { body?: unknown }).body
    if (body) {
      init.body = typeof body === 'string' ? body : JSON.stringify(body)
    }
    const res = await proxyRequest(url, init)
    return res as Response<U['response']>
  }
  return { client }
}

function createRouteClients<T extends string, U extends RouteMethodType>(
  urlBase: string,
  path: T,
  routes: U
) {
  const toPath = compile(path)
  const clients = {} as {
    [key in keyof U]: ReturnType<typeof createClient<T, U[key]>>
  }

  for (const method of ['GET', 'POST', 'PUT', 'DELETE'] as const) {
    if (routes[method]) {
      clients[method] = createClient(urlBase, toPath, method)
    }
  }

  return clients
}

function createAllClients<T extends Record<string, RouteMethodType>>(
  base: T,
  urlBase: string
) {
  const clients: Record<string, ReturnType<typeof createRouteClients>> = {}

  for (const path of Object.keys(base)) {
    const routes = base[path]
    clients[path] = createRouteClients(urlBase, path, routes)
  }

  return clients as {
    [key in keyof T & string]: ReturnType<
      typeof createRouteClients<key, T[key]>
    >
  }
}

export const clients = createAllClients(apis, API_URL_BASE)
export const authClients = createAllClients(authApis, AUTH_URL_BASE)
