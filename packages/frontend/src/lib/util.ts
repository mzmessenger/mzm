import { ClientToSocketType } from 'mzm-shared/type/socket'
import { logger } from './logger'

export const sendSocket = (socket: WebSocket, message: ClientToSocketType) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    logger.warn('socket is not ready:', socket, message)
    return
  }
  socket.send(JSON.stringify(message))
}

export const isReplied = (account: string, message: string) => {
  return new RegExp(`([\\s]+|^)@${account}(?:[^a-z]|$)`).test(message)
}

export const getRoomName = (pathname: string) => {
  const res = pathname.match(/\/rooms\/(.+)/) || ''
  return res[1] ? decodeURIComponent(res[1]) : ''
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
