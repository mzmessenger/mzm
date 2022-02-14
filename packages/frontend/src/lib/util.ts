import { ClientToSocketType } from 'mzm-shared/type/socket'

export const sendSocket = (socket: WebSocket, message: ClientToSocketType) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn('socket is not ready:', socket, message)
    return
  }
  socket.send(JSON.stringify(message))
}

export const isReplied = (account: string, message: string) => {
  return new RegExp(`([\\s]+|^)@${account}(?:[^a-z]|$)`).test(message)
}

export const getRoomName = (path: string) => {
  const roomName = path.match(/rooms\/(.+)($|\/)/) && RegExp.$1
  return roomName
}
