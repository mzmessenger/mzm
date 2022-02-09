import { sendSocket } from '../../lib/util'
import { SendSocketMessage, SendSocketCmd } from '../../type'

export const sendMessage = (
  socket: WebSocket,
  message: string,
  roomId: string,
  vote?: { questions: { text: string }[] }
) => {
  const send: SendSocketMessage = {
    cmd: SendSocketCmd.MESSAGE_SEND,
    message: message,
    room: roomId
  }
  if (vote) {
    send.vote = vote
  }
  sendSocket(socket, send)
}

export const sendModifyMessage = (
  socket: WebSocket,
  message: string,
  messageId: string
) => {
  const send: SendSocketMessage = {
    cmd: SendSocketCmd.MESSAGE_MODIFY,
    message: message,
    id: messageId
  }
  sendSocket(socket, send)
}

export const incrementIine = (socket: WebSocket, messageId: string) => {
  sendSocket(socket, {
    cmd: SendSocketCmd.MESSAGE_IINE,
    id: messageId
  })
}

export const sortRoom = (socket: WebSocket, roomOrder: string[]) => {
  sendSocket(socket, {
    cmd: SendSocketCmd.ROOMS_SORT,
    roomOrder
  })
}

export const openRoom = (socket: WebSocket, roomId: string) => {
  sendSocket(socket, {
    cmd: SendSocketCmd.ROOMS_OPEN,
    roomId
  })
}

export const closeRoom = (socket: WebSocket, roomId: string) => {
  sendSocket(socket, {
    cmd: SendSocketCmd.ROOMS_CLOSE,
    roomId
  })
}
