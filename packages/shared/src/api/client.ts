/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  type RouteType,
  type HasParamsInPath,
  type RouteParams,
  type DefinedType,
  type RouteMethodType,
  type Method
} from './type.js'
import { methods } from './universal.js'
import { compile } from 'path-to-regexp'

type ClinetOptions<TPath extends string, TRoute extends RouteType> = {
  fetcher?: typeof defaultFetcher
} & (HasParamsInPath<TPath> extends true
  ? {
      params: RouteParams<TPath>
    }
  : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    {}) & {
    [key in keyof TRoute['request']]: TRoute['request'][key] extends (
      arg: any
    ) => any
      ? ReturnType<TRoute['request'][key]>
      : never
  }

type Response<
  TRouteTypeResponse extends RouteType['response'],
  TStatus extends number = keyof TRouteTypeResponse & number
> = TStatus extends keyof RouteType['response']
  ? {
      ok: TStatus extends 200 ? true : false
      status: TStatus
      body: TRouteTypeResponse[TStatus] extends { body: (arg: any) => any }
        ? DefinedType<TRouteTypeResponse[TStatus]['body']>
        : never
    }
  : {
      ok: boolean
      status: number
      body: unknown
    }

function createClient<TPath extends string, TRoute extends RouteType>(
  url: string,
  toPath: (params: RouteParams<TPath>) => string,
  method: Method
) {
  const client = async (options: ClinetOptions<TPath, TRoute>) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    let path = toPath(options.params ?? {})
    const query = options.query ?? {}
    if (Object.keys(query).length > 0) {
      const q = new URLSearchParams(query)
      path += `?${q.toString()}`
    }

    const fetcher = options.fetcher ?? defaultFetcher
    const fetcherOptions: Parameters<Fetcher>[0] = {
      url: url + path,
      method,
      headers: {
        ...options.headers
      }
    }

    const contentType = (() => {
      if (options.headers?.['Content-Type']) {
        return options.headers['Content-Type']
      }
      if (options.form) {
        return undefined
      }
      return 'application/json'
    })()

    if (contentType) {
      fetcherOptions.headers['Content-Type'] = contentType
    }

    if (options.form) {
      const formData = new FormData()
      for (const [key, val] of Object.entries(options.form)) {
        formData.append(key, val)
      }
      fetcherOptions.form = formData
    }

    if (options.body) {
      fetcherOptions.body = options.body
    }
    return await fetcher<Response<TRoute['response']>>(fetcherOptions)
  }
  return { client }
}

function createRouteClients<
  TPath extends string,
  TRoutes extends RouteMethodType
>(url: string, path: TPath, routes: TRoutes) {
  const toPath = compile(path)
  const clients = {} as {
    [key in keyof TRoutes & Method]: ReturnType<
      typeof createClient<TPath, Exclude<TRoutes[key], undefined>>
    >
  }

  for (const method of methods) {
    if (routes[method]) {
      clients[method] = createClient(url, toPath, method)
    }
  }

  return clients
}

async function defaultFetcher<T>(options: {
  url: string
  method: Method
  headers: Record<string, string>
  body?: BodyInit
  form?: FormData
}) {
  const init: Parameters<typeof fetch>[1] = {
    method: options.method,
    headers: options.headers
  }

  if (options.body) {
    init.body =
      typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
  }

  if (options.form) {
    init.body = options.form
  }

  const res = await fetch(options.url, init)

  let body = await res.text()
  if (
    body.length > 0 &&
    options.headers['Content-Type']?.includes('application/json')
  ) {
    body = JSON.parse(body)
  }

  return {
    ok: res.ok,
    status: res.status,
    body: body
  } as T
}

export type Fetcher = typeof defaultFetcher
export type fetcherOptions = Parameters<typeof defaultFetcher>[0]

export function createClients<T extends Record<string, RouteMethodType>>(
  apis: T,
  url = ''
) {
  const clients: Record<string, ReturnType<typeof createRouteClients>> = {}

  for (const path of Object.keys(apis)) {
    const routes = apis[path]
    clients[path] = createRouteClients(url, path, routes)
  }

  return clients as {
    [key in keyof T & string]: ReturnType<
      typeof createRouteClients<key, T[key]>
    >
  }
}
