import { vi, test, expect } from 'vitest'
vi.mock('../lib/logger.js')
vi.mock('./internal/socket.js')

import { ObjectId } from 'mongodb'
import { TO_SERVER_CMD } from 'mzm-shared/src/type/socket'
import { createRequest } from '../../test/testUtil.js'
import { socket } from './internal.js'
import {
  sendMessage,
  modifyMessage,
  getMessagesFromRoom,
  enterRoom,
  readMessage,
  iine,
  sortRooms,
  getRooms,
  openRoom,
  closeRoom,
  sendVoteAnswer,
  removeVoteAnswer,
  updateRoomDescription
} from './internal/socket.js'

test.each([
  [TO_SERVER_CMD.MESSAGE_SEND, sendMessage],
  [TO_SERVER_CMD.MESSAGE_MODIFY, modifyMessage],
  [TO_SERVER_CMD.MESSAGES_ROOM, getMessagesFromRoom],
  [TO_SERVER_CMD.MESSAGE_IINE, iine],
  [TO_SERVER_CMD.ROOMS_ENTER, enterRoom],
  [TO_SERVER_CMD.ROOMS_READ, readMessage],
  [TO_SERVER_CMD.ROOMS_SORT, sortRooms],
  [TO_SERVER_CMD.ROOMS_GET, getRooms],
  [TO_SERVER_CMD.ROOMS_OPEN, openRoom],
  [TO_SERVER_CMD.ROOMS_CLOSE, closeRoom],
  [TO_SERVER_CMD.VOTE_ANSWER_SEND, sendVoteAnswer],
  [TO_SERVER_CMD.VOTE_ANSWER_REMOVE, removeVoteAnswer],
  [TO_SERVER_CMD.ROOMS_UPDATE_DESCRIPTION, updateRoomDescription]
])('socket %s', async (cmd, called) => {
  const userId = new ObjectId()
  const body = { cmd }
  const req = createRequest(userId, { body })

  const calledMock = vi.mocked(called)
  calledMock.mockClear()

  await socket(req)

  expect(calledMock.mock.calls.length).toStrictEqual(1)
})
