/* eslint-disable @typescript-eslint/ban-types, @typescript-eslint/no-unused-vars, no-unused-vars */

export type RouteParams<T extends string> =
  T extends `${infer _}:${infer IParam}/${infer IRest}`
    ? { [k in IParam | keyof RouteParams<IRest>]: string }
    : T extends `${infer _}:${infer IParam}`
    ? { [k in IParam]: string }
    : {}

export type API = {
  '/api/rooms': {
    POST: {
      REQUEST: {
        body: {
          name: string
        }
      }
      RESPONSE: {
        200: { id: string; name: string }
      }
    }
  }
  '/api/rooms/enter': {
    DELETE: {
      REQUEST: {
        body: {
          room: string
        }
      }
    }
  }
  '/api/rooms/search': {
    GET: {
      REQUEST: {
        query: {
          query?: string
          scroll?: string
        }
      }
      RESPONSE: {
        200: {
          query: string | null
          hits: {
            id: string
            name: string
            iconUrl: string | null
            description?: string
          }[]
          total: number
          scroll: string | null
        }
      }
    }
  }
  '/api/rooms/:roomid/users': {
    GET: {
      REQUEST: {
        params: RouteParams<'/api/rooms/:roomid/users'>
        query: {
          threshold: string
        }
      }
      RESPONSE: {
        200: {
          count: number
          users: {
            userId: string
            account: string
            icon: string | null
            enterId: string
          }[]
        }
      }
    }
  }
  '/api/icon/rooms/:roomname': {
    POST: {
      REQUEST: {
        params: RouteParams<'/api/icon/rooms/:roomname'>
      }
      RESPONSE: {
        200: {
          id: string
          version: string
        }
      }
    }
  }
  '/api/icon/rooms/:roomname/:version': {
    GET: {
      REQUEST: {
        params: RouteParams<'/api/icon/rooms/:roomname/:version'>
      }
      RESPONSE: {
        200: ReadableStream
      }
    }
  }
  '/api/icon/user/:account/:version': {
    GET: {
      REQUEST: {
        params: RouteParams<'/api/icon/user/:account/:version'>
      }
      RESPONSE: {
        200: ReadableStream
      }
    }
  }
  '/api/icon/user/:account': {
    GET: {
      REQUEST: {
        params: RouteParams<'/api/icon/user/:account'>
      }
      RESPONSE: {
        200: ReadableStream
      }
    }
  }
  '/api/icon/user': {
    POST: {
      RESPONSE: {
        200: {
          version: string
        }
      }
    }
  }
  '/api/user/@me': {
    GET: {
      RESPONSE: {
        200: {
          id: string
          account: string
          icon: string | null
        }
        404: {
          reason: string
          id: string
        }
      }
    }
    PUT: {
      REQUEST: {
        body: {
          account: string
        }
      }
      RESPONSE: {
        200: {
          id: string
          account: string
        }
        400: string
      }
    }
  }
  '/api/user/signup': {
    POST: {
      REQUEST: {
        body: {
          account: string
        }
      }
    }
  }
}

export type AUTH_API_RESPONSE = {
  '/auth/token': {
    POST: {
      RESPONSE: {
        200: {
          accessToken: string
          refreshToken: string
          user: {
            _id: string
            twitterId: string | null
            twitterUserName: string | null
            githubId: string | null
            githubUserName: string | null
          }
        }
      }
    }
  }
}
