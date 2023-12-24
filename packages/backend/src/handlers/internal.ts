import type { Request } from 'express'
import {
  TO_SERVER_CMD,
  type SocketToBackendType,
  type ToClientType
} from 'mzm-shared/src/type/socket'
import {
  getRequestUserId,
  getRequestGithubUserName,
  getRequestTwitterUserName
} from '../lib/utils.js'
import { logger } from '../lib/logger.js'
import * as _socket from './internal/socket.js'
import { sendToUser } from '../lib/fetchStreaming.js'

type Res = void | undefined | ToClientType

export const socket = async (req: Request): Promise<Res> => {
  const user = getRequestUserId(req)
  const data = req.body as SocketToBackendType
  logger.info('socket', user, data)
  let res: Res = undefined
  if (data.cmd === TO_SERVER_CMD.CONNECTION) {
    const twitterUserName = getRequestTwitterUserName(req)
    const githubUserName = getRequestGithubUserName(req)
    res = await _socket.connection(user, data, {
      twitterUserName,
      githubUserName
    })
  } else if (data.cmd === TO_SERVER_CMD.MESSAGE_SEND) {
    res = await _socket.sendMessage(user, data)
  } else if (data.cmd === TO_SERVER_CMD.MESSAGE_IINE) {
    res = await _socket.iine(user, data)
  } else if (data.cmd === TO_SERVER_CMD.MESSAGE_MODIFY) {
    res = await _socket.modifyMessage(user, data)
  } else if (data.cmd === TO_SERVER_CMD.MESSAGE_REMOVE) {
    res = await _socket.removeMessage(user, data)
  } else if (data.cmd === TO_SERVER_CMD.MESSAGES_ROOM) {
    res = await _socket.getMessagesFromRoom(user, data)
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_GET) {
    res = await _socket.getRooms(user)
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_ENTER) {
    res = await _socket.enterRoom(user, data)
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_UPDATE_DESCRIPTION) {
    res = await _socket.updateRoomDescription(user, data)
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_READ) {
    res = await _socket.readMessage(user, data)
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_SORT) {
    res = await _socket.sortRooms(user, data)
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_OPEN) {
    res = await _socket.openRoom(user, data)
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_CLOSE) {
    res = await _socket.closeRoom(user, data)
  } else if (data.cmd === TO_SERVER_CMD.VOTE_ANSWER_SEND) {
    res = await _socket.sendVoteAnswer(user, data)
  } else if (data.cmd === TO_SERVER_CMD.VOTE_ANSWER_REMOVE) {
    res = await _socket.removeVoteAnswer(user, data)
  }
  if (res) {
    sendToUser(user, Buffer.from(JSON.stringify(res)))
  }
  return res
}
