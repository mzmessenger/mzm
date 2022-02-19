export type RESPONSE = {
  '/api/rooms': {
    POST: { id: string; name: string }
  }
  '/api/rooms/search': {
    GET: {
      query: string
      hits: { id: string; name: string; iconUrl: string }[]
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
      id: string
      account: string
      icon: string
      twitterUserName: string | null
      githubUserName: string | null
    }
  }
}
