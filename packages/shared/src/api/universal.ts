/* eslint-disable @typescript-eslint/ban-types, no-unused-vars, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { RouteType, RouteParams, ApiType } from '../type/api.js'

function define<T>() {
  return (args: T) => args
}

type Routes = {
  [key: string]: {
    GET?: RouteType
    POST?: RouteType
    PUT?: RouteType
    DELETE?: RouteType
  }
}

const routes = {
  '/api/rooms': {
    POST: {
      request: {
        body: define<{ name: string }>()
      },
      response: {
        200: {
          body: define<{ id: string; name: string }>()
        }
      }
    }
  },
  '/api/rooms/enter': {
    DELETE: {
      request: {
        body: define<{ room: string }>()
      },
      response: {
        200: {
          body: define<void>()
        }
      }
    }
  },
  '/api/rooms/search': {
    GET: {
      request: {
        query: define<{
          query?: string
          scroll?: string
        }>()
      },
      response: {
        200: {
          body: define<{
            query: string | null
            hits: {
              id: string
              name: string
              iconUrl: string | null
              description?: string
            }[]
            total: number
            scroll: string | null
          }>()
        }
      }
    }
  },
  '/api/rooms/:roomid/users': {
    GET: {
      request: {
        query: define<{ threshold?: string }>()
      },
      response: {
        200: {
          body: define<{
            count: number
            users: {
              userId: string
              account: string
              icon: string | null
              enterId: string
            }[]
          }>()
        }
      }
    }
  },
  '/api/icon/rooms/:roomname': {
    POST: {
      request: {},
      response: {
        200: {
          body: define<{
            id: string
            version: string
          }>()
        }
      }
    }
  },
  '/api/icon/rooms/:roomname/:version': {
    GET: {
      request: {},
      response: {
        200: {
          body: define<void>()
        }
      }
    }
  },
  '/api/icon/user/:account/:version': {
    GET: {
      request: {},
      response: {
        200: {
          body: define<void>()
        }
      }
    }
  },
  '/api/icon/user/:account': {
    GET: {
      request: {},
      response: {
        200: { body: define<void>() }
      }
    }
  },
  '/api/icon/user': {
    POST: {
      request: {},
      response: {
        200: {
          body: define<{
            version: string
          }>()
        }
      }
    }
  },
  '/api/user/@me': {
    GET: {
      request: {},
      response: {
        200: {
          body: define<{
            id: string
            account: string
            icon: string | null
          }>()
        },
        404: {
          body: define<{
            reason: string
            id: string
          }>()
        }
      }
    },
    PUT: {
      request: {
        body: define<{
          account: string
        }>()
      },
      response: {
        200: {
          body: define<{
            id: string
            account: string
          }>()
        },
        400: {
          body: define<string>()
        }
      }
    }
  }
} as const satisfies Routes

const authRoute = {
  '/auth/token': {
    POST: {
      request: {},
      response: {
        200: {
          body: define<{
            accessToken: string
            refreshToken: string
            user: {
              _id: string
              twitterId: string | null
              twitterUserName: string | null
              githubId: string | null
              githubUserName: string | null
            }
          }>()
        }
      }
    }
  }
} as const satisfies Routes

function proxyedRoute<T extends typeof routes | typeof authRoute>(routes: T) {
  return new Proxy(routes, {
    get(target, prop) {
      return {
        ...Reflect.get(target, prop),
        params: define(),
        path: prop
      }
    }
  }) as {
    [key in keyof T]: T[key] & {
      path: key
      params: (args: RouteParams<key>) => RouteParams<key>
    }
  }
}

export const apis = proxyedRoute(routes)
export const authApi = proxyedRoute(authRoute)
export type API = ApiType<typeof apis>
export type AuthAPI = ApiType<typeof authApi>
