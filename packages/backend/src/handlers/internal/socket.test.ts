/* eslint-disable @typescript-eslint/ban-ts-comment */
import { vi, expect } from 'vitest'
import { createTest } from '../../../test/testUtil.js'
vi.mock('../../lib/logger.js')
vi.mock('../../logic/messages.js')
vi.mock('../../lib/provider/index.js')

import { ObjectId } from 'mongodb'
import { VoteStatusEnum, VoteTypeEnum } from 'mzm-shared/src/type/db'
import { TO_SERVER_CMD } from 'mzm-shared/src/type/socket'
import {
  collections,
  RoomStatusEnum,
  VoteAnswerEnum,
  type Message
} from '../../lib/db.js'
import * as logicMessages from '../../logic/messages.js'
import {
  addMessageQueue,
  addQueueToUsers,
  addUnreadQueue
} from '../../lib/provider/index.js'
import * as config from '../../config.js'
import * as socket from './socket.js'

const test = await createTest(globalThis)

test('sendMessage', async ({ testDb, testRedis }) => {
  const roomId = new ObjectId()
  const userId = new ObjectId()

  await collections(testDb).users.insertOne({
    _id: userId,
    account: 'test',
    roomOrder: []
  })

  const message = 'post'

  const insertedIdMock = new ObjectId()
  const saveMessageMock = vi.mocked(logicMessages.saveMessage)
  saveMessageMock.mockClear()
  saveMessageMock.mockResolvedValueOnce({
    insertedId: insertedIdMock,
    // @ts-expect-error
    acknowledged: null
  })
  const addQueueToUsersMock = vi.mocked(addQueueToUsers)
  addQueueToUsersMock.mockClear()
  const addUnreadQueueMock = vi.mocked(addUnreadQueue)
  addUnreadQueueMock.mockClear()

  await socket.sendMessage({
    db: testDb,
    redis: testRedis,
    user: userId.toHexString(),
    data: {
      cmd: 'message:send',
      message: message,
      room: roomId.toHexString()
    }
  })

  expect(saveMessageMock.mock.calls.length).toStrictEqual(1)
  const args = saveMessageMock.mock.calls[0]

  expect(args[1]).toStrictEqual(message)
  expect(args[2]).toStrictEqual(roomId.toHexString())
  expect(args[3]).toStrictEqual(userId.toHexString())

  expect(addUnreadQueueMock.mock.calls.length).toStrictEqual(1)
  expect(addQueueToUsersMock.mock.calls.length).toStrictEqual(1)
})

test('fail: sendMessage', async ({ testDb, testRedis }) => {
  const roomId = new ObjectId()
  const userId = new ObjectId()

  await collections(testDb).users.insertOne({
    _id: userId,
    account: 'test',
    roomOrder: []
  })

  const beforeCount = await collections(testDb).messages.countDocuments()
  const message = 'a'.repeat(config.message.MAX_MESSAGE_LENGTH + 1)

  const saveMessageMock = vi.mocked(logicMessages.saveMessage)
  saveMessageMock.mockClear()
  const addQueueToUsersMock = vi.mocked(addQueueToUsers)
  addQueueToUsersMock.mockClear()
  const addUnreadQueueMock = vi.mocked(addUnreadQueue)
  addUnreadQueueMock.mockClear()

  await socket.sendMessage({
    db: testDb,
    redis: testRedis,
    user: userId.toHexString(),
    data: {
      cmd: 'message:send',
      message: message,
      room: roomId.toHexString()
    }
  })

  const afterCount = await collections(testDb).messages.countDocuments()

  expect(beforeCount).toStrictEqual(afterCount)
  expect(saveMessageMock.mock.calls.length).toStrictEqual(1)
  expect(addUnreadQueueMock.mock.calls.length).toStrictEqual(0)
  expect(addQueueToUsersMock.mock.calls.length).toStrictEqual(0)
})

test('modifyMessage', async ({ testDb, testRedis }) => {
  const roomId = new ObjectId()
  const userId = new ObjectId()
  const createdAt = new Date()

  const user = collections(testDb).users.insertOne({
    _id: userId,
    account: 'test',
    roomOrder: []
  })

  const message = collections(testDb).messages.insertOne({
    roomId,
    userId,
    updated: false,
    removed: false,
    message: 'insert',
    iine: 0,
    createdAt,
    updatedAt: null
  })

  const [created] = await Promise.all([message, user])

  const addQueueToUsersMock = vi.mocked(addQueueToUsers)
  addQueueToUsersMock.mockClear()

  await socket.modifyMessage({
    db: testDb,
    redis: testRedis,
    user: userId.toHexString(),
    data: {
      cmd: 'message:modify',
      id: created.insertedId.toHexString(),
      message: 'modify'
    }
  })

  const updated = await collections(testDb).messages.findOne({
    _id: created.insertedId
  })

  expect(updated?.message).toStrictEqual('modify')
  expect(updated?.roomId.toHexString()).toStrictEqual(roomId.toHexString())
  expect(updated?.userId.toHexString()).toStrictEqual(userId.toHexString())
  expect(updated?.createdAt.getTime()).toStrictEqual(createdAt.getTime())
  expect(updated?.updated).toStrictEqual(true)
  expect(updated?.updatedAt).not.toBeNull()

  expect(addQueueToUsersMock.mock.calls.length).toStrictEqual(1)
})

test('readMessage', async ({ testDb, testRedis }) => {
  const roomId = new ObjectId()
  const userId = new ObjectId()

  await Promise.all([
    collections(testDb).users.insertOne({
      _id: userId,
      account: 'test',
      roomOrder: []
    }),
    collections(testDb).enter.insertOne({
      userId,
      roomId,
      unreadCounter: 10,
      replied: 1
    })
  ])

  const addMessageQueueMock = vi.mocked(addMessageQueue)
  addMessageQueueMock.mockClear()

  await socket.readMessage({
    db: testDb,
    redis: testRedis,
    user: userId.toHexString(),
    data: {
      cmd: 'rooms:read',
      room: roomId.toHexString()
    }
  })

  const updated = await collections(testDb).enter.findOne({ userId, roomId })

  expect(updated?.unreadCounter).toStrictEqual(0)
  expect(updated?.replied).toStrictEqual(0)

  expect(addMessageQueueMock.mock.calls.length).toStrictEqual(1)
})

test('iine', async ({ testDb, testRedis }) => {
  const userId = new ObjectId()

  const seed = await collections(testDb).messages.insertOne({
    roomId: new ObjectId(),
    userId,
    message: 'iine',
    iine: 1,
    updated: false,
    removed: false,
    createdAt: new Date(),
    updatedAt: null
  })

  await socket.iine({
    db: testDb,
    redis: testRedis,
    data: {
      cmd: 'message:iine',
      id: seed.insertedId.toHexString()
    }
  })

  const message = await collections(testDb).messages.findOne({
    _id: seed.insertedId
  })

  expect(message?.iine).toStrictEqual(2)
})

test('openRoom', async ({ testDb }) => {
  const userId = new ObjectId()

  const insert = await collections(testDb).rooms.insertOne({
    name: userId.toHexString(),
    status: RoomStatusEnum.CLOSE,
    createdBy: 'system'
  })

  await socket.openRoom({
    db: testDb,
    user: userId.toHexString(),
    data: {
      cmd: TO_SERVER_CMD.ROOMS_OPEN,
      roomId: insert.insertedId.toHexString()
    }
  })

  const updated = await collections(testDb).rooms.findOne({
    _id: insert.insertedId
  })

  expect(updated?.status).toStrictEqual(RoomStatusEnum.OPEN)
  expect(updated?.updatedBy).toStrictEqual(userId)
})

test('closeRoom', async ({ testDb }) => {
  const userId = new ObjectId()

  const insert = await collections(testDb).rooms.insertOne({
    name: userId.toHexString(),
    status: RoomStatusEnum.OPEN,
    createdBy: 'system'
  })

  await socket.closeRoom({
    db: testDb,
    user: userId.toHexString(),
    data: {
      cmd: TO_SERVER_CMD.ROOMS_CLOSE,
      roomId: insert.insertedId.toHexString()
    }
  })

  const updated = await collections(testDb).rooms.findOne({
    _id: insert.insertedId
  })

  expect(updated?.status).toStrictEqual(RoomStatusEnum.CLOSE)
  expect(updated?.updatedBy).toStrictEqual(userId)
})

test('sendVoteAnswer (first time)', async ({ testDb, testRedis }) => {
  const userId = new ObjectId()
  const vote: Message['vote'] = {
    questions: [{ text: '4/1' }, { text: '4/2' }, { text: '4/3' }],
    status: VoteStatusEnum.OPEN,
    type: VoteTypeEnum.CHOICE
  }

  const message = await collections(testDb).messages.insertOne({
    message: 'vote test',
    iine: 0,
    roomId: new ObjectId(),
    userId: userId,
    updated: false,
    removed: false,
    createdAt: new Date(),
    updatedAt: null,
    vote: vote
  })

  await socket.sendVoteAnswer({
    db: testDb,
    redis: testRedis,
    user: userId.toHexString(),
    data: {
      cmd: TO_SERVER_CMD.VOTE_ANSWER_SEND,
      messageId: message.insertedId.toHexString(),
      index: 0,
      answer: VoteAnswerEnum.OK
    }
  })

  const answers = await collections(testDb)
    .voteAnswer.find({ messageId: message.insertedId })
    .toArray()

  expect(answers.length).toStrictEqual(1)
})

test('sendVoteAnswer (second time)', async ({ testDb, testRedis }) => {
  const userId = new ObjectId()

  const vote: Message['vote'] = {
    questions: [{ text: '4/1' }, { text: '4/2' }, { text: '4/3' }],
    status: VoteStatusEnum.OPEN,
    type: VoteTypeEnum.CHOICE
  }

  const message = await collections(testDb).messages.insertOne({
    message: 'vote test',
    iine: 0,
    roomId: new ObjectId(),
    userId: userId,
    updated: false,
    removed: false,
    createdAt: new Date(),
    updatedAt: null,
    vote: vote
  })

  const insertVote = await collections(testDb).voteAnswer.insertOne({
    messageId: message.insertedId,
    userId: userId,
    index: 0,
    answer: VoteAnswerEnum.OK
  })

  const before = await collections(testDb)
    .voteAnswer.find({ messageId: message.insertedId })
    .toArray()

  expect(before.length).toStrictEqual(1)
  expect(before[0].answer).toStrictEqual(VoteAnswerEnum.OK)

  await socket.sendVoteAnswer({
    db: testDb,
    redis: testRedis,
    user: userId.toHexString(),
    data: {
      cmd: TO_SERVER_CMD.VOTE_ANSWER_SEND,
      messageId: message.insertedId.toHexString(),
      index: 0,
      answer: VoteAnswerEnum.NG
    }
  })

  const answers = await collections(testDb)
    .voteAnswer.find({ messageId: message.insertedId })
    .toArray()

  expect(answers.length).toStrictEqual(1)

  const updated = await collections(testDb).voteAnswer.findOne({
    _id: insertVote.insertedId
  })

  expect(updated?.answer).toStrictEqual(VoteAnswerEnum.NG)
})

test('removeVoteAnswer', async ({ testDb, testRedis }) => {
  const userId = new ObjectId()

  const vote: Message['vote'] = {
    questions: [{ text: '4/1' }, { text: '4/2' }, { text: '4/3' }],
    status: VoteStatusEnum.OPEN,
    type: VoteTypeEnum.CHOICE
  }

  const message = await collections(testDb).messages.insertOne({
    message: 'vote test',
    iine: 0,
    roomId: new ObjectId(),
    userId: userId,
    updated: false,
    removed: false,
    createdAt: new Date(),
    updatedAt: null,
    vote: vote
  })

  await collections(testDb).voteAnswer.insertOne({
    messageId: message.insertedId,
    userId: userId,
    index: 0,
    answer: VoteAnswerEnum.OK
  })

  const before = await collections(testDb)
    .voteAnswer.find({ messageId: message.insertedId })
    .toArray()

  expect(before.length).toStrictEqual(1)
  expect(before[0].answer).toStrictEqual(VoteAnswerEnum.OK)

  await socket.removeVoteAnswer({
    db: testDb,
    redis: testRedis,
    user: userId.toHexString(),
    data: {
      cmd: TO_SERVER_CMD.VOTE_ANSWER_REMOVE,
      messageId: message.insertedId.toHexString(),
      index: 0
    }
  })

  const answers = await collections(testDb)
    .voteAnswer.find({ messageId: message.insertedId })
    .toArray()

  expect(answers.length).toStrictEqual(0)
})

test('fail: updateRoomDescription over length', async ({
  testDb,
  testRedis
}) => {
  const userId = new ObjectId()
  const roomId = new ObjectId()

  const addQueueToUsersMock = vi.mocked(addQueueToUsers)
  addQueueToUsersMock.mockClear()

  await socket.updateRoomDescription({
    db: testDb,
    redis: testRedis,
    user: userId.toHexString(),
    data: {
      cmd: TO_SERVER_CMD.ROOMS_UPDATE_DESCRIPTION,
      description: 'a'.repeat(config.room.MAX_ROOM_DESCRIPTION_LENGTH + 1),
      roomId: roomId.toHexString()
    }
  })

  expect(addQueueToUsersMock).toBeCalledTimes(0)
})
