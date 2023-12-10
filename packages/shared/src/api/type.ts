/* eslint-disable no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/ban-types */
export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
export type HttpStatus = number

export type HasParamsInPath<T extends string> =
  T extends `${infer _}/:${infer _}` ? true : false

export type RouteType = {
  request: {
    query?: (args: any) => any
    body?: (args: any) => any
    form?: (args: any) => any
    headers?: (args: any) => any
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
  [k in Method]?: RouteType
}

export type Routes<T extends string> = {
  [key in T]: RouteMethodType
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

export type DefinedRoute<T extends RouteType> = {
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
