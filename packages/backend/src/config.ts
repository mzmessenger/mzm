import { config } from 'dotenv'
if (process.env.NODE_ENV !== 'test') {
  config()
}

export const MONGODB_URI =
  process.env.NODE_ENV === 'test' ? null : process.env.MONGODB_URI

export const PORT = process.env.PORT ?? 3001

export const WORKER_NUM = process.env.WORKER_NUM ?? 1

export const AUTH_SERVER = process.env.AUTH_SERVER

export const account = {
  MIN_LENGTH: 2,
  MAX_LENGTH: 30
} as const

// https://en.wikipedia.org/wiki/Whitespace_character

const unicode = [
  '\u0009',
  '\u000A',
  '\u000B',
  '\u000C',
  '\u0020',
  '\u0085',
  '\u00A0',
  '\u0323',
  '\u1680',
  '\u180E',
  '\u2000',
  '\u2001',
  '\u2002',
  '\u2003',
  '\u2004',
  '\u2005',
  '\u2006',
  '\u2007',
  '\u2008',
  '\u2009',
  '\u200A',
  '\u200B',
  '\u200C',
  '\u200D',
  '\u2028',
  '\u2029',
  '\u202A',
  '\u202F',
  '\u205F',
  '\u2060',
  '\u2061',
  '\u2062',
  '\u2063',
  '\u2064',
  '\u3000',
  '\u3164',
  '\uFEFF',
  '\uFFA0'
] as const

export const room = {
  GENERAL_ROOM_NAME: 'general',
  USER_LIMIT: 20,
  MESSAGE_LIMIT: 20,
  MAX_ROOM_NAME_LENGTH: 30,
  MIN_ROOM_NAME_LENGTH: 1,
  MAX_ROOM_DESCRIPTION_LENGTH: 5000,
  BANNED_ROOM_NAME: ['undefined', 'null', 'NaN'],
  BANNED_CHARS_REGEXP_IN_ROOM_NAME: /^@|\/|\\|\s|&|\?|=/,
  BANNED_UNICODE_REGEXP_IN_ROOM_NAME: new RegExp(unicode.join('|'))
} as const

export const message = {
  MAX_MESSAGE_LENGTH: 3000,
  MIN_MESSAGE_LENGTH: 1
} as const

export const stream = {
  REMOVE_USER: 'stream:backend:remove:user',
  MESSAGE: 'stream:socket:message',
  UNREAD: 'stream:unread',
  REPLY: 'stream:reply',
  VOTE: 'stream:vote',
  ELASTICSEARCH_ROOMS: 'stream:elasticsearch:rooms',
  JOB: 'stream:job'
} as const

export const icon = {
  MAX_USER_ICON_SIZE: 400,
  USER_ICON_PREFIX: 'usericon/',
  MAX_ROOM_ICON_SIZE: 400,
  ROOM_ICON_PREFIX: 'roomicon/'
} as const

export const MULTER_PATH = '/tmp' ?? process.env.MULTER_PATH

export const aws = {
  AWS_BUCKET: process.env.AWS_BUCKET,
  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY
} as const

export const redis = {
  options: {
    host: process.env.REDIS_HOST,
    enableOfflineQueue: false
  }
} as const

export const elasticsearch = {
  client: {
    node: process.env.ELASTICSEARCH_NODE
  },
  alias: {
    room: 'rooms'
  },
  index: {
    room: 'index-rooms-v1'
  },
  size: {
    room: 5
  }
} as const

export const lock = {
  INIT_GENERAL_ROOM: 'lock:INIT_GENERAL_ROOM',
  INIT_CONSUMER_GROUP: 'lock:INIT_CONSUMER_GROUP',
  INIT_SEARCH_ROOM_QUEUE: 'lock:INIT_SEARCH_ROOM_QUEUE',
  INIT_SEARCH_ROOM: 'lock:INIT_SEARCH_ROOM',
  SYNC_SEARCH_ROOM_QUEUE: 'lock:SYNC_SEARCH_ROOM_QUEUE',
  CREATE_ROOM: 'lock:CREATE_ROOM'
} as const

export const vote = {
  MAX_QUESTION_NUM: 5,
  MAX_QUESTION_LENGTH: 100
} as const

export const JWT = {
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET
} as const
