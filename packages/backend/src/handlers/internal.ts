import { Request } from 'express'
import { SocketToBackendType, TO_SERVER_CMD } from 'mzm-shared/type/socket'
import { getRequestUserId } from '../lib/utils'
import * as _socket from './internal/socket'

export const socket = async (req: Request) => {
  const user = getRequestUserId(req)
  const data = req.body as SocketToBackendType
  if (data.cmd === TO_SERVER_CMD.CONNECTION) {
    return await _socket.connection(user, data)
  } else if (data.cmd === TO_SERVER_CMD.MESSAGE_SEND) {
    return await _socket.sendMessage(user, data)
  } else if (data.cmd === TO_SERVER_CMD.MESSAGE_IINE) {
    return await _socket.iine(user, data)
  } else if (data.cmd === TO_SERVER_CMD.MESSAGE_MODIFY) {
    return _socket.modifyMessage(user, data)
  } else if (data.cmd === TO_SERVER_CMD.MESSAGE_REMOVE) {
    return _socket.removeMessage(user, data)
  } else if (data.cmd === TO_SERVER_CMD.MESSAGES_ROOM) {
    return _socket.getMessagesFromRoom(user, data)
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_GET) {
    return _socket.getRooms(user)
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_ENTER) {
    return _socket.enterRoom(user, data)
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_UPDATE_DESCRIPTION) {
    return _socket.updateRoomDescription(user, data)
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_READ) {
    return _socket.readMessage(user, data)
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_SORT) {
    return _socket.sortRooms(user, data)
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_OPEN) {
    return await _socket.openRoom(user, data)
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_CLOSE) {
    return await _socket.closeRoom(user, data)
  } else if (data.cmd === TO_SERVER_CMD.VOTE_ANSWER_SEND) {
    return await _socket.sendVoteAnswer(user, data)
  } else if (data.cmd === TO_SERVER_CMD.VOTE_ANSWER_REMOVE) {
    return await _socket.removeVoteAnswer(user, data)
  }
  return
}
