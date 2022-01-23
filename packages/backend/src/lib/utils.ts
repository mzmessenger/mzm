import { IncomingMessage } from 'http'
import { Request } from 'express'
import escape from 'validator/lib/escape'
import trim from 'validator/lib/trim'

export const getRequestUserId = (req: IncomingMessage | Request): string => {
  const user: string = req.headers['x-user-id'] as string
  return user
}

export const popParam = (param: string): string => {
  if (!param) {
    return ''
  }
  return escape(trim(param || '').trim())
}

export const createUserIconPath = (
  account: string,
  version?: string
): string => {
  if (!account) {
    return null
  }
  let icon = `/api/icon/user/${account}`
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
    ? `/api/icon/rooms/${room.name}/${room.icon.version}`
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
