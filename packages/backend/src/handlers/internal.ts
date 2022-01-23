import { Request } from 'express'
import * as _socket from './internal/socket'

export const socket = async (req: Request) => {
  const user: string = req.headers['x-user-id'] as string
  const data = req.body as _socket.ReceiveMessage
  if (data.cmd === _socket.ReceiveMessageCmd.MESSAGE_SEND) {
    return await _socket.sendMessage(user, data)
  } else if (data.cmd === _socket.ReceiveMessageCmd.MESSAGE_IINE) {
    return await _socket.iine(user, data)
  } else if (data.cmd === _socket.ReceiveMessageCmd.MESSAGE_MODIFY) {
    return _socket.modifyMessage(user, data)
  } else if (data.cmd === _socket.ReceiveMessageCmd.MESSAGES_ROOM) {
    return _socket.getMessagesFromRoom(user, data)
  } else if (data.cmd === _socket.ReceiveMessageCmd.ROOMS_GET) {
    return _socket.getRooms(user)
  } else if (data.cmd === _socket.ReceiveMessageCmd.ROOMS_ENTER) {
    return _socket.enterRoom(user, data)
  } else if (data.cmd === _socket.ReceiveMessageCmd.ROOMS_READ) {
    return _socket.readMessage(user, data)
  } else if (data.cmd === _socket.ReceiveMessageCmd.ROOMS_SORT) {
    return _socket.sortRooms(user, data)
  } else if (data.cmd === _socket.ReceiveMessageCmd.ROOMS_OPEN) {
    return await _socket.openRoom(user, data)
  } else if (data.cmd === _socket.ReceiveMessageCmd.ROOMS_CLOSE) {
    return await _socket.closeRoom(user, data)
  } else if (data.cmd === _socket.ReceiveMessageCmd.VOTE_ANSWER_SEND) {
    return await _socket.sendVoteAnswer(user, data)
  } else if (data.cmd === _socket.ReceiveMessageCmd.VOTE_ANSWER_REMOVE) {
    return await _socket.removeVoteAnswer(user, data)
  }
  return
}
