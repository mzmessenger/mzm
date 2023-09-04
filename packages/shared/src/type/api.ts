/* eslint-disable @typescript-eslint/ban-types, @typescript-eslint/no-unused-vars, no-unused-vars, @typescript-eslint/no-explicit-any */
export { API, AuthAPI } from '../api/universal.js'

export type HasParamsInPath<T extends string | number | symbol> =
  T extends `${infer _}/:${infer _}` ? true : false

export type HttpStatus = 200 | 400 | 403 | 404

export type RouteType = {
  request: {
    query?: (args: any) => any
    body?: (args: any) => any
    form?: (args: any) => any
  }
  response: {
    200: {
      body: (args: any) => any
    }
  } & {
    [key in Exclude<HttpStatus, 200>]?: {
      body: (args: any) => any
    }
  }
}

export type RouteMethodType = {
  GET?: RouteType
  POST?: RouteType
  PUT?: RouteType
  DELETE?: RouteType
}

export type Routes = {
  [key: string]: RouteMethodType
}

export type RouteParams<T> =
  T extends `${infer _}:${infer IParam}/${infer IRest}`
    ? { [k in IParam | keyof RouteParams<IRest>]: string }
    : T extends `${infer _}:${infer IParam}`
    ? { [k in IParam]: string }
    : {}

export type DefinedType<T> = T extends infer Q extends (...args: any) => any
  ? ReturnType<Q>
  : unknown

type DefinedRoute<T extends RouteType> = {
  request: {
    [key in keyof T['request']]: DefinedType<T['request'][key]>
  }
  response: {
    [key in keyof T['response']]: {
      [paramsKey in keyof T['response'][key]]: DefinedType<
        T['response'][key][paramsKey]
      >
    }
  }
}

export type ApiType<
  Api extends {
    [key in string]: {
      [methodKey in 'GET' | 'POST' | 'PUT' | 'DELETE']?: RouteType
    }
  }
> = {
  [key in keyof Api & string]: { params: RouteParams<key> } & {
    [methodKey in keyof Api[key]]: Api[key][methodKey] extends RouteType
      ? DefinedRoute<Api[key][methodKey]>
      : never
  }
}
