import type { IncomingMessage } from 'http'
import type { Request } from 'express'
import { HEADERS } from 'mzm-shared/auth/constants'
import validator from 'validator'
import { API_URL_BASE } from '../config.js'

export const getRequestUserId = (req: IncomingMessage | Request): string => {
  const user: string = req.headers[HEADERS.USER_ID] as string
  return user
}

export const popParam = (param: string): string => {
  if (!param) {
    return ''
  }
  return validator.escape(validator.trim(param || '').trim())
}

export const createUserIconPath = (
  account: string,
  version?: string
): string => {
  if (!account) {
    return null
  }
  let icon = `${API_URL_BASE}/api/icon/user/${account}`
  if (version) {
    icon += `/${version}`
  }
  return icon
}

export const createRoomIconPath = (room: import('./db').Room): string => {
  if (!room) {
    return null
  }

  const icon = room.icon
    ? `${API_URL_BASE}/api/icon/rooms/${room.name}/${room.icon.version}`
    : null

  return icon
}

export const repliedAccounts = (message: string) => {
  const accounts = []
  const matches = message.matchAll(/@(?<account>[a-zA-Z\d_-]+)(\s|$)/g)
  for (const match of matches) {
    const account = match?.groups?.account
    if (account && !accounts.includes(account)) {
      accounts.push(account)
    }
  }
  return accounts
}
