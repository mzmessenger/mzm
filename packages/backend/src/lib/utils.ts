import type { IncomingMessage } from 'http'
import type { Request } from 'express'
import type { Result } from 'mzm-shared/src/type'
import type { Room } from './db.js'
import { type ZodType, z } from 'zod'
import { HEADERS } from 'mzm-shared/src/auth/constants'
import { API_URL_BASE } from '../config.js'

export const getRequestUserId = (req: IncomingMessage | Request): string => {
  const user: string = req.headers[HEADERS.USER_ID] as string
  return user
}

export const escape = (str: string) => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/'/g, '&#x27;')
    .replace(/"/g, '&quot;')
    .replace(/`/g, '&#96;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\//g, '&#x2F;')
    .replace(/\\/g, '&#x5C;')
}

export const unescape = (str: string) => {
  return str
    .replace(/&#x5C;/g, '\\')
    .replace(/&#x2F;/g, '/')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&#96;/g, '`')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
}

export const popParam = (param: string | undefined): string => {
  if (!param) {
    return ''
  }
  return escape(param.trim()).trim()
}

export const createUserIconPath = (
  account: string,
  version?: string
): string | null => {
  if (!account) {
    return null
  }
  let icon = `${API_URL_BASE}/api/icon/user/${account}`
  if (version) {
    icon += `/${version}`
  }
  return icon
}

export const createRoomIconPath = (room: Room): string | null => {
  if (!room) {
    return null
  }

  const icon = room.icon
    ? `${API_URL_BASE}/api/icon/rooms/${room.name}/${room.icon.version}`
    : null

  return icon
}

export const repliedAccounts = (message: string) => {
  const accounts: string[] = []
  const matches = message.matchAll(/@(?<account>[a-zA-Z\d_-]+)(\s|$)/g)
  for (const match of matches) {
    const account = match?.groups?.account
    if (account && !accounts.includes(account)) {
      accounts.push(account)
    }
  }
  return accounts
}

export const createContextParser = <TParser extends ZodType, TRes>(
  parser: TParser,
  successHandler: (
    parsed: z.SafeParseSuccess<z.infer<TParser>>
  ) => Result<TRes>,
  errorHandler?: (parsed: z.SafeParseError<unknown>) => Result<TRes>
) => {
  return (input: unknown): Result<TRes> => {
    const parsed = parser.safeParse(input)
    if (parsed.success === false) {
      if (errorHandler) {
        return errorHandler(parsed)
      }
      return {
        success: false,
        error: {
          message: parsed.error.message
        }
      }
    }
    return successHandler(parsed)
  }
}
