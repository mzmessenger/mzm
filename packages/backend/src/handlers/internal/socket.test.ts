/* eslint-disable @typescript-eslint/ban-ts-comment, no-empty-pattern */
import { vi, test as baseTest, expect, describe, beforeEach } from 'vitest'
vi.mock('../../lib/logger.js')
vi.mock('../../logic/messages.js')
vi.mock('../../lib/provider/index.js')
vi.mock('../../lib/db.js', async () => {
  const actual =
    await vi.importActual<typeof import('../../lib/db.js')>('../../lib/db.js')
  return { ...actual, mongoClient: vi.fn() }
})

import { ObjectId } from 'mongodb'
import { VoteStatusEnum, VoteTypeEnum } from 'mzm-shared/src/type/db'
import {
  TO_SERVER_CMD,
  FilterSocketToBackendType
} from 'mzm-shared/src/type/socket'
import { 
  getTestMongoClient
} from '../../../test/testUtil.js'
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
  addUnreadQueue,
  addUpdateSearchRoomQueue
} from '../../lib/provider/index.js'
import * as config from '../../config.js'
import * as socket from './socket.js'

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

test('sendMessage', async ({ testDb }) => {
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

  await socket.sendMessage(testDb, userId.toHexString(), {
    cmd: 'message:send',
    message: message,
    room: roomId.toHexString()
  })

  expect(saveMessageMock.mock.calls.length).toStrictEqual(1)
  const args = saveMessageMock.mock.calls[0]

  expect(args[1]).toStrictEqual(message)
  expect(args[2]).toStrictEqual(roomId.toHexString())
  expect(args[3]).toStrictEqual(userId.toHexString())

  expect(addUnreadQueueMock.mock.calls.length).toStrictEqual(1)
  expect(addQueueToUsersMock.mock.calls.length).toStrictEqual(1)
})

test('fail: sendMessage', async ({ testDb }) => {
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

  await socket.sendMessage(testDb, userId.toHexString(), {
    cmd: 'message:send',
    message: message,
    room: roomId.toHexString()
  })

  const afterCount = await collections(testDb).messages.countDocuments()

  expect(beforeCount).toStrictEqual(afterCount)
  expect(saveMessageMock.mock.calls.length).toStrictEqual(1)
  expect(addUnreadQueueMock.mock.calls.length).toStrictEqual(0)
  expect(addQueueToUsersMock.mock.calls.length).toStrictEqual(0)
})

test('modifyMessage', async ({ testDb }) => {
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

  await socket.modifyMessage(testDb, userId.toHexString(), {
    cmd: 'message:modify',
    id: created.insertedId.toHexString(),
    message: 'modify'
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

test('readMessage', async ({ testDb }) => {
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

  await socket.readMessage(testDb, userId.toHexString(), {
    cmd: 'rooms:read',
    room: roomId.toHexString()
  })

  const updated = await collections(testDb).enter.findOne({ userId, roomId })

  expect(updated?.unreadCounter).toStrictEqual(0)
  expect(updated?.replied).toStrictEqual(0)

  expect(addMessageQueueMock.mock.calls.length).toStrictEqual(1)
})

test('iine', async ({ testDb }) => {
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

  await socket.iine(testDb, userId.toHexString(), {
    cmd: 'message:iine',
    id: seed.insertedId.toHexString()
  })

  const message = await collections(testDb).messages.findOne({
    _id: seed.insertedId
  })

  expect(message?.iine).toStrictEqual(2)
})

test('openRoom', async ({ testDb }) => {
  const queueMock = vi.mocked(addUpdateSearchRoomQueue)
  queueMock.mockClear()

  const userId = new ObjectId()

  const insert = await collections(testDb).rooms.insertOne({
    name: userId.toHexString(),
    status: RoomStatusEnum.CLOSE,
    createdBy: 'system'
  })

  await socket.openRoom(testDb, userId.toHexString(), {
    cmd: TO_SERVER_CMD.ROOMS_OPEN,
    roomId: insert.insertedId.toHexString()
  })

  const updated = await collections(testDb).rooms.findOne({
    _id: insert.insertedId
  })

  expect(updated?.status).toStrictEqual(RoomStatusEnum.OPEN)
  expect(updated?.updatedBy).toStrictEqual(userId)
  expect(queueMock.call.length).toStrictEqual(1)
})

test('closeRoom', async ({ testDb }) => {
  const queueMock = vi.mocked(addUpdateSearchRoomQueue)
  queueMock.mockClear()

  const userId = new ObjectId()

  const insert = await collections(testDb).rooms.insertOne({
    name: userId.toHexString(),
    status: RoomStatusEnum.OPEN,
    createdBy: 'system'
  })

  await socket.closeRoom(testDb, userId.toHexString(), {
    cmd: TO_SERVER_CMD.ROOMS_CLOSE,
    roomId: insert.insertedId.toHexString()
  })

  const updated = await collections(testDb).rooms.findOne({
    _id: insert.insertedId
  })

  expect(updated?.status).toStrictEqual(RoomStatusEnum.CLOSE)
  expect(updated?.updatedBy).toStrictEqual(userId)
  expect(queueMock.call.length).toStrictEqual(1)
})

test('sendVoteAnswer (first time)', async ({ testDb }) => {
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

  await socket.sendVoteAnswer(testDb, userId.toHexString(), {
    cmd: TO_SERVER_CMD.VOTE_ANSWER_SEND,
    messageId: message.insertedId.toHexString(),
    index: 0,
    answer: VoteAnswerEnum.OK
  })

  const answers = await collections(testDb)
    .voteAnswer.find({ messageId: message.insertedId })
    .toArray()

  expect(answers.length).toStrictEqual(1)
})

test('sendVoteAnswer (second time)', async ({ testDb }) => {
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

  await socket.sendVoteAnswer(testDb, userId.toHexString(), {
    cmd: TO_SERVER_CMD.VOTE_ANSWER_SEND,
    messageId: message.insertedId.toHexString(),
    index: 0,
    answer: VoteAnswerEnum.NG
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

describe('sendVoteAnswer: BadRequest', () => {
  let messageId: ObjectId | null = null
  let userId: ObjectId | null = null

  beforeEach(async () => {
    userId = new ObjectId()

    const vote: Message['vote'] = {
      questions: [{ text: '4/1' }, { text: '4/2' }, { text: '4/3' }],
      status: VoteStatusEnum.OPEN,
      type: VoteTypeEnum.CHOICE
    }

    const db = await getTestMongoClient(globalThis)
    const message = await collections(db).messages.insertOne({
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
    messageId = message.insertedId
  })

  test('no messageId', async ({ testDb }) => {
    const before = await collections(testDb)
      .voteAnswer.find({ messageId: messageId! })
      .toArray()

    await socket.sendVoteAnswer(testDb, userId!.toHexString(), {
      cmd: TO_SERVER_CMD.VOTE_ANSWER_SEND,
      index: 0,
      answer: VoteAnswerEnum.OK
    } as FilterSocketToBackendType<typeof TO_SERVER_CMD.VOTE_ANSWER_SEND>)

    const after = await collections(testDb)
      .voteAnswer.find({ messageId: messageId! })
      .toArray()

    expect(before.length).toStrictEqual(after.length)
  })

  test.for([
    ['no index', TO_SERVER_CMD.VOTE_ANSWER_SEND, VoteAnswerEnum.OK, undefined]
  ] as const)('%s', async ([, cmd, answer, index], { testDb }) => {
    await socket.sendVoteAnswer(testDb, userId!.toHexString(), {
      messageId: messageId!.toHexString(),
      cmd,
      answer,
      // @ts-expect-error
      index
    })

    const answers = await collections(testDb)
      .voteAnswer.find({
        messageId: messageId!
      })
      .toArray()

    expect(answers.length).toStrictEqual(0)
  })
})

test('removeVoteAnswer', async ({ testDb }) => {
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

  await socket.removeVoteAnswer(testDb, userId.toHexString(), {
    cmd: TO_SERVER_CMD.VOTE_ANSWER_REMOVE,
    messageId: message.insertedId.toHexString(),
    index: 0
  })

  const answers = await collections(testDb)
    .voteAnswer.find({ messageId: message.insertedId })
    .toArray()

  expect(answers.length).toStrictEqual(0)
})

test('fail: updateRoomDescription over length', async ({ testDb }) => {
  const userId = new ObjectId()
  const roomId = new ObjectId()

  const addQueueToUsersMock = vi.mocked(addQueueToUsers)
  addQueueToUsersMock.mockClear()

  await socket.updateRoomDescription(testDb, userId.toHexString(), {
    cmd: TO_SERVER_CMD.ROOMS_UPDATE_DESCRIPTION,
    description: 'a'.repeat(config.room.MAX_ROOM_DESCRIPTION_LENGTH + 1),
    roomId: roomId.toHexString()
  })

  expect(addQueueToUsersMock).toBeCalledTimes(0)
})
