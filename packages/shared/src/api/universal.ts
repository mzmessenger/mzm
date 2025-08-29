import type {
  Method,
  Routes,
  RouteParams,
  HasParamsInPath,
  RouteType,
  DefinedRoute
} from './type.js'

export type {
  RouteType,
  HasParamsInPath,
  RouteParams,
  DefinedType,
  RouteMethodType,
  Method
} from './type.js'

import type { RoomStatusEnum } from '../type/db.js'

export function define<T>() {
  return (args: T) => args
}

export const methods: readonly Method[] = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH'
] as const

function addParams<T extends Routes<string>>(apis: T) {
  for (const [key, api] of Object.entries(apis)) {
    if (key.includes('/:')) {
      for (const method of Object.keys(api)) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        api[method].request.params = define<typeof key>()
      }
    }
  }
  return apis as {
    [key in keyof T & string]: {
      [methodKey in keyof T[key]]: (HasParamsInPath<key> extends true
        ? {
            request: {
              params: (params: RouteParams<key>) => RouteParams<key>
            }
          }
        : // eslint-disable-next-line @typescript-eslint/no-empty-object-type
          {}) &
        T[key][methodKey]
    }
  }
}

export function defineApis<T extends Routes<TKeys>, TKeys extends string>(
  apis: T
) {
  const paramsApi = addParams(apis)
  return { apis: paramsApi }
}

export const { apis } = defineApis({
  '/api/rooms': {
    GET: {
      request: {
        query: define<{
          threshold?: string
        }>()
      },
      response: {
        200: {
          body: define<{
            rooms: {
              id: string
              name: string
              description?: string
              iconUrl: string | null
              status: (typeof RoomStatusEnum)[keyof typeof RoomStatusEnum]
            }[]
            total: number
          }>()
        }
      }
    },
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
      request: {
        form: define<{ icon: Blob }>()
      },
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
      request: {
        form: define<{ icon: Blob }>()
      },
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
        403: {
          body: define<unknown>()
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
  },
  '/api/socket': {
    POST: {
      request: {
        body: define<import('../type/socket.js').ClientToSocketType>()
      },
      response: {
        200: {
          body: define<void>()
        }
      }
    }
  }
})

export const { apis: authApis } = defineApis({
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
})

type ApiType<
  Api extends {
    [key in string]: {
      [methodKey in Method]?: RouteType
    }
  }
> = {
  [key in keyof Api & string]: { params: RouteParams<key> } & {
    [methodKey in keyof Api[key]]: Api[key][methodKey] extends RouteType
      ? DefinedRoute<Api[key][methodKey]>
      : never
  }
}

export type API = ApiType<typeof apis>
export type AuthAPI = ApiType<typeof authApis>
