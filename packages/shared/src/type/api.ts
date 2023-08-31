/* eslint-disable @typescript-eslint/ban-types, @typescript-eslint/no-unused-vars, no-unused-vars, @typescript-eslint/no-explicit-any */
export type { API, AuthAPI } from '../api/universal.js'

export type HttpStatus = 200 | 400 | 404

type Response = {
  200: {
    body: (args: any) => any
  }
} & {
  [key in Exclude<HttpStatus, 200>]?: {
    body: (args: any) => any
  }
}

export type RouteType = {
  request: {
    query?: (args: any) => any
    body?: (args: any) => any
  }
  response: Response
}

export type RouteParams<T> =
  T extends `${infer _}:${infer IParam}/${infer IRest}`
    ? { [k in IParam | keyof RouteParams<IRest>]: string }
    : T extends `${infer _}:${infer IParam}`
    ? { [k in IParam]: string }
    : {}

type DefinedType<T> = T extends infer Q extends (...args: any) => any
  ? ReturnType<Q>
  : undefined

type ParamsType<T, P extends 'query' | 'body' | 'params'> = T extends {
  [k in P]: infer Q
}
  ? { [k in P]: DefinedType<Q> }
  : {}

type ResponseStatusType<
  T extends RouteType['response'],
  S extends HttpStatus
> = T extends { [k in S]: infer U } ? { [k in S]: ParamsType<U, 'body'> } : {}

type DefinedRoute<T extends RouteType> = {
  request: ParamsType<T['request'], 'query'> & ParamsType<T['request'], 'body'>
  response: ResponseStatusType<T['response'], 200> &
    ResponseStatusType<T['response'], 400> &
    ResponseStatusType<T['response'], 404>
}

export type MethodType<
  Api extends {
    [key: string]: { [k in 'GET' | 'POST' | 'PUT' | 'DELETE']?: RouteType }
  },
  Key extends keyof Api,
  M extends 'GET' | 'POST' | 'PUT' | 'DELETE'
> = Api[Key] extends {
  [k in M]: infer U extends RouteType
}
  ? {
      [k in M]: DefinedRoute<U>
    }
  : {}

export type ApiType<
  Api extends {
    [key in string]: {
      [k in 'GET' | 'POST' | 'PUT' | 'DELETE']?: RouteType
    }
  }
> = {
  [key in keyof Api]: { path: key } & ParamsType<Api[key], 'params'> &
    MethodType<Api, key, 'GET'> &
    MethodType<Api, key, 'POST'> &
    MethodType<Api, key, 'PUT'> &
    MethodType<Api, key, 'DELETE'>
}
