jest.mock('../lib/logger')
jest.mock('./internal/socket')

import { ObjectId } from 'mongodb'
import { getMockType, createRequest } from '../../jest/testUtil'
import { socket } from './internal'
import {
  connection,
  ReceiveMessageCmd,
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
  removeVoteAnswer
} from './internal/socket'

test.each([
  [ReceiveMessageCmd.CONNECTION, connection],
  [ReceiveMessageCmd.MESSAGE_SEND, sendMessage],
  [ReceiveMessageCmd.MESSAGE_MODIFY, modifyMessage],
  [ReceiveMessageCmd.MESSAGES_ROOM, getMessagesFromRoom],
  [ReceiveMessageCmd.MESSAGE_IINE, iine],
  [ReceiveMessageCmd.ROOMS_ENTER, enterRoom],
  [ReceiveMessageCmd.ROOMS_READ, readMessage],
  [ReceiveMessageCmd.ROOMS_SORT, sortRooms],
  [ReceiveMessageCmd.ROOMS_GET, getRooms],
  [ReceiveMessageCmd.ROOMS_OPEN, openRoom],
  [ReceiveMessageCmd.ROOMS_CLOSE, closeRoom],
  [ReceiveMessageCmd.VOTE_ANSWER_SEND, sendVoteAnswer],
  [ReceiveMessageCmd.VOTE_ANSWER_REMOVE, removeVoteAnswer]
])('socket %s', async (cmd, called: any) => {
  const userId = new ObjectId()
  const body = { cmd }
  const req = createRequest(userId, { body })

  const calledMock = getMockType(called)
  calledMock.mockClear()

  await socket(req)

  expect(calledMock.mock.calls.length).toStrictEqual(1)
})
