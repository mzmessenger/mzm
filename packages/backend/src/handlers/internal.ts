import type { Request } from 'express'
import type { MongoClient } from 'mongodb'
import {
  TO_SERVER_CMD,
  type SocketToBackendType,
  type ToClientType
} from 'mzm-shared/src/type/socket'
import { getRequestUserId } from '../lib/utils.js'
import { logger } from '../lib/logger.js'
import * as _socket from './internal/socket.js'
import { sendToUser } from '../lib/fetchStreaming.js'
import { ExRedisClient } from '../lib/redis.js'

type Res = void | undefined | ToClientType

export async function socket(
  req: Request,
  { db, redis }: { db: MongoClient; redis: ExRedisClient }
): Promise<Res> {
  const user = getRequestUserId(req)
  const data = req.body as SocketToBackendType
  logger.info('socket', user, data)
  let res: Res = undefined
  if (data.cmd === TO_SERVER_CMD.MESSAGE_SEND) {
    res = await _socket.sendMessage({ db, redis, user, data })
  } else if (data.cmd === TO_SERVER_CMD.MESSAGE_IINE) {
    res = await _socket.iine({ db, redis, data })
  } else if (data.cmd === TO_SERVER_CMD.MESSAGE_MODIFY) {
    res = await _socket.modifyMessage({ db, redis, user, data })
  } else if (data.cmd === TO_SERVER_CMD.MESSAGE_REMOVE) {
    res = await _socket.removeMessage({ db, redis, user, data })
  } else if (data.cmd === TO_SERVER_CMD.MESSAGES_ROOM) {
    res = await _socket.getMessagesFromRoom({ db, user, data })
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_GET) {
    res = await _socket.getRooms({ db, user })
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_ENTER) {
    res = await _socket.enterRoom({ db, redis, user, data })
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_UPDATE_DESCRIPTION) {
    res = await _socket.updateRoomDescription({ db, redis, user, data })
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_READ) {
    res = await _socket.readMessage({ db, redis, user, data })
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_SORT) {
    res = await _socket.sortRooms({ db, redis, user, data })
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_OPEN) {
    res = await _socket.openRoom({ db, redis, user, data })
  } else if (data.cmd === TO_SERVER_CMD.ROOMS_CLOSE) {
    res = await _socket.closeRoom({ db, redis, user, data })
  } else if (data.cmd === TO_SERVER_CMD.VOTE_ANSWER_SEND) {
    res = await _socket.sendVoteAnswer({ db, redis, user, data })
  } else if (data.cmd === TO_SERVER_CMD.VOTE_ANSWER_REMOVE) {
    res = await _socket.removeVoteAnswer({ db, redis, user, data })
  }
  if (res) {
    sendToUser(user, Buffer.from(JSON.stringify(res)))
  }
  return res
}
