import type { IncomingMessage } from 'http'
import type { Request } from 'express'
import { HEADERS } from 'mzm-shared/auth/constants'
import validator from 'validator'

export const getRequestUserId = (req: IncomingMessage | Request): string => {
  const user: string = req.headers[HEADERS.USER_ID] as string
  return user
}

export const getRequestTwitterUserName = (
  req: IncomingMessage | Request
): string | null => {
  const twitter = (req.headers[HEADERS.TIWTTER_USER_NAME] as string) ?? null
  return twitter
}

export const getRequestGithubUserName = (
  req: IncomingMessage | Request
): string | null => {
  const github = (req.headers[HEADERS.GITHUB_USER_NAME] as string) ?? null
  return github
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
