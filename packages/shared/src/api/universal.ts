/* eslint-disable @typescript-eslint/ban-types, no-unused-vars, @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import type {
  Routes,
  RouteParams,
  ApiType,
  HasParamsInPath
} from '../type/api.js'

function define<T>() {
  return (args: T) => args
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
  '/api/rooms/:roomId/users': {
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
  '/api/icon/rooms/:roomName': {
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
  '/api/icon/rooms/:roomName/:version': {
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

const authRoutes = {
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
  },
  '/auth/user': {
    DELETE: {
      request: {},
      response: {
        200: { body: define<void>() }
      }
    }
  },
  '/auth/twitter': {
    DELETE: {
      request: {},
      response: {
        200: { body: define<void>() }
      }
    }
  },
  '/auth/github': {
    DELETE: {
      request: {},
      response: {
        200: { body: define<void>() }
      }
    }
  }
} as const satisfies Routes

function createToPath<T extends Routes>(routes: T) {
  return Object.keys(routes).reduce(
    (prev, key) => {
      return { ...prev, [key]: { params: define() } }
    },
    {} as {
      [key in keyof T]: {
        params: HasParamsInPath<key> extends true
          ? (params: RouteParams<key>) => RouteParams<key>
          : undefined
      }
    }
  )
}

const keyToPath = createToPath(routes)
export function convertKeyToPath<T extends keyof typeof keyToPath>(key: T) {
  return keyToPath[key]
}
const authKeyToPath = createToPath(authRoutes)
export function convertAuthKeyToPath<T extends keyof typeof authKeyToPath>(
  key: T
) {
  return authKeyToPath[key]
}

export const apis = routes
export const authApis = authRoutes
export type API = ApiType<typeof apis>
export type AuthAPI = ApiType<typeof authApis>
