import type { Method } from './type.js'

export type PublicRoute = {
  path: string
  methods: readonly Method[]
}

export const publicRoutePaths = {
  auth: {
    root: '/',
    authorize: '/authorize',
    token: '/auth/token',
    twitter: '/auth/twitter',
    twitterCallback: '/auth/twitter/callback',
    github: '/auth/github',
    githubCallback: '/auth/github/callback',
    logout: '/auth/logout',
    user: '/auth/user',
    error: '/auth/error'
  },
  api: {
    socket: '/api/socket',
    rooms: '/api/rooms',
    roomsEnter: '/api/rooms/enter',
    roomsSearch: '/api/rooms/search',
    roomsUsers: '/api/rooms/:roomId/users',
    userMe: '/api/user/@me',
    userIcon: '/api/icon/user',
    userIconByAccount: '/api/icon/user/:account',
    userIconByVersion: '/api/icon/user/:account/:version',
    roomIcon: '/api/icon/rooms/:roomName',
    roomIconByVersion: '/api/icon/rooms/:roomName/:version'
  }
} as const

export const publicRoutes = {
  auth: [
    { path: publicRoutePaths.auth.root, methods: ['GET'] },
    { path: publicRoutePaths.auth.authorize, methods: ['GET'] },
    { path: publicRoutePaths.auth.token, methods: ['POST'] },
    { path: publicRoutePaths.auth.twitter, methods: ['GET', 'DELETE'] },
    {
      path: publicRoutePaths.auth.twitterCallback,
      methods: ['GET']
    },
    { path: publicRoutePaths.auth.github, methods: ['GET', 'DELETE'] },
    {
      path: publicRoutePaths.auth.githubCallback,
      methods: ['GET']
    },
    { path: publicRoutePaths.auth.logout, methods: ['GET'] },
    { path: publicRoutePaths.auth.user, methods: ['DELETE'] },
    { path: publicRoutePaths.auth.error, methods: ['GET'] }
  ],
  api: [
    { path: publicRoutePaths.api.socket, methods: ['GET', 'POST'] },
    { path: publicRoutePaths.api.rooms, methods: ['GET', 'POST'] },
    { path: publicRoutePaths.api.roomsEnter, methods: ['DELETE'] },
    { path: publicRoutePaths.api.roomsSearch, methods: ['GET'] },
    { path: publicRoutePaths.api.roomsUsers, methods: ['GET'] },
    { path: publicRoutePaths.api.userMe, methods: ['GET', 'PUT'] },
    { path: publicRoutePaths.api.userIcon, methods: ['POST'] },
    {
      path: publicRoutePaths.api.userIconByAccount,
      methods: ['GET']
    },
    {
      path: publicRoutePaths.api.userIconByVersion,
      methods: ['GET']
    },
    { path: publicRoutePaths.api.roomIcon, methods: ['POST'] },
    {
      path: publicRoutePaths.api.roomIconByVersion,
      methods: ['GET']
    }
  ]
} as const satisfies {
  auth: readonly PublicRoute[]
  api: readonly PublicRoute[]
}
