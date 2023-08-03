export type RESPONSE = {
  '/api/rooms': {
    POST: { id: string; name: string }
  }
  '/api/rooms/search': {
    GET: {
      query: string
      hits: {
        id: string
        name: string
        iconUrl: string
        description?: string
      }[]
      total: number
      scroll: string | null
    }
  }
  '/api/rooms/:roomid/users': {
    GET: {
      count: number
      users: {
        userId: string
        account: string
        icon: string
        enterId: string
      }[]
    }
  }
  '/api/icon/rooms/:roomname': {
    POST: {
      id: string
      version: string
    }
  }
  '/api/icon/user': {
    POST: {
      version: string
    }
  }
  '/api/user/@me': {
    GET: {
      body: {
        200: {
          id: string
          account: string
          icon: string
        }
        404: {
          reason: string
          id: string
        }
      }
    }
    PUT: {
      body: {
        200: {
          id: string
          account: string
        }
        400: string
      }
    }
  }
}

export type REQUEST = {
  '/api/rooms': {
    POST: {
      body: {
        name: string
      }
    }
  }
  '/api/rooms/enter': {
    DELETE: {
      body: {
        room: string
      }
    }
  }
  '/api/rooms/:roomid/users': {
    GET: {
      query: {
        threshold: string
      }
    }
  }
  '/api/rooms/search': {
    GET: {
      query: {
        query?: string
        scroll?: string
      }
    }
  }
  '/api/user/@me': {
    PUT: {
      body: {
        account: string
      }
    }
  }
  '/api/user/signup': {
    POST: {
      body: {
        account: string
      }
    }
  }
}

export type AUTH_API_RESPONSE = {
  '/auth/token': {
    POST: {
      body: {
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
