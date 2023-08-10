import { ExtWebSocket } from '../types.js'
import { logger } from './logger.js'

const socketMap = new Map<string, ExtWebSocket>()
const userMap = new Map<string, ExtWebSocket[]>()

export const clear = () => {
  socketMap.clear()
  userMap.clear()
}

export const saveSocket = (id: string, user: string, ws: ExtWebSocket) => {
  socketMap.set(id, ws)

  if (userMap.has(user)) {
    const list = userMap.get(user)
    if (list) {
      list.push(ws)
      userMap.set(user, list)
    }
  } else {
    userMap.set(user, [ws])
  }
}

export const removeSocket = (id: string, user: string) => {
  socketMap.delete(id)
  const list = (userMap.get(user) ?? []).filter((e) => e.id !== id)
  userMap.set(user, list)
}

export const sendToUser = (user: string, payload: unknown) => {
  if (!userMap.has(user)) {
    return false
  }
  const sockets = userMap.get(user)
  if (!sockets) {
    return false
  }
  sockets.forEach((s) => s.send(JSON.stringify(payload)))
  logger.info('[send:message:user]', user, payload)
  return true
}
