/* eslint-disable no-empty-pattern */
import { vi, test as baseTest, expect, beforeEach } from 'vitest'
vi.mock('../lib/logger.js')
vi.mock('../lib/db.js', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/db.js')>('../lib/db.js')
  return { ...actual, mongoClient: vi.fn() }
})

import { ObjectId } from 'mongodb'
import { VoteStatusEnum, VoteTypeEnum } from 'mzm-shared/src/type/db'
import { getTestMongoClient, dropCollection } from '../../test/testUtil.js'
import { collections, COLLECTION_NAMES, type Message } from '../lib/db.js'
import { saveMessage, getMessages } from './messages.js'
import * as config from '../config.js'

const test = baseTest.extend<{
  testDb: Awaited<ReturnType<typeof getTestMongoClient>>
}>({
  testDb: async ({}, use) => {
    const db = await getTestMongoClient(globalThis)
    await use(db)
  }
})

beforeEach(async () => {
  const db = await getTestMongoClient(globalThis)
  await dropCollection(db, COLLECTION_NAMES.MESSAGES)
})

test('saveMessage', async ({ testDb }) => {
  const message = 'test'
  const roomId = new ObjectId()
  const userId = new ObjectId()

  const save = await saveMessage(
    testDb,
    message,
    roomId.toHexString(),
    userId.toHexString()
  )

  if (!save) {
    expect(true).toStrictEqual(false)
    return
  }

  const found = await collections(testDb).messages.findOne({
    _id: save.insertedId
  })

  expect(found?._id).toStrictEqual(save.insertedId)
  expect(found?.message).toStrictEqual(message)
  expect(found?.roomId.toHexString()).toStrictEqual(roomId.toHexString())
  expect(found?.userId.toHexString()).toStrictEqual(userId.toHexString())
})

test.for([[''], ['a'.repeat(config.message.MAX_MESSAGE_LENGTH + 1)]])(
  'valid: saveMessage (%s)',
  async ([message], { testDb }) => {
    const roomId = new ObjectId()
    const userId = new ObjectId()

    const beforeCount = await collections(testDb).messages.countDocuments()

    const save = await saveMessage(
      testDb,
      message,
      roomId.toHexString(),
      userId.toHexString()
    )

    const afterCount = await collections(testDb).messages.countDocuments()

    expect(save).toStrictEqual(false)
    expect(beforeCount).toStrictEqual(afterCount)
  }
)

test('getMessages', async ({ testDb }) => {
  const overNum = 2
  const userId = new ObjectId()
  const account = 'test'
  await collections(testDb).users.insertOne({
    _id: userId,
    account,
    roomOrder: []
  })
  const roomId = new ObjectId()

  const insert: Omit<Message, '_id'>[] = []
  for (let i = 0; i < config.room.MESSAGE_LIMIT + overNum; i++) {
    const message: Omit<Message, '_id'> = {
      message: `${i}-message`,
      roomId,
      userId,
      iine: i,
      updated: false,
      removed: false,
      createdAt: new Date(),
      updatedAt: null
    }
    insert.push(message)
  }

  await collections(testDb).messages.insertMany(insert)

  let messages = await getMessages(testDb, roomId.toHexString())

  const idList = messages.messages.map((message) => new ObjectId(message.id))
  const messageMap = (
    await collections(testDb)
      .messages.find({
        _id: { $in: idList }
      })
      .toArray()
  ).reduce((map, current) => {
    map.set(current._id.toHexString(), current)
    return map
  }, new Map<string, Message>())

  expect(messages.existHistory).toStrictEqual(true)
  expect(messages.messages.length).toStrictEqual(config.room.MESSAGE_LIMIT)

  for (const message of messages.messages) {
    expect(message.userId).toStrictEqual(userId.toHexString())
    expect(message.userAccount).toStrictEqual(account)
    expect(messageMap.get(message.id)?.roomId.toHexString()).toStrictEqual(
      roomId.toHexString()
    )
    expect(message.iine).toStrictEqual(messageMap.get(message.id)?.iine)
  }

  messages = await getMessages(
    testDb,
    roomId.toHexString(),
    messages.messages[0].id
  )

  expect(messages.existHistory).toStrictEqual(false)
  expect(messages.messages.length).toStrictEqual(overNum)
})

test('getMessages just', async ({ testDb }) => {
  const userId = new ObjectId()
  const account = 'test'
  await collections(testDb).users.insertOne({
    _id: userId,
    account,
    roomOrder: []
  })
  const roomId = new ObjectId()

  const insert: Omit<Message, '_id'>[] = []
  for (let i = 0; i < config.room.MESSAGE_LIMIT * 2; i++) {
    const message: Omit<Message, '_id'> = {
      message: `${i}-message`,
      roomId,
      userId,
      iine: 0,
      updated: false,
      removed: false,
      createdAt: new Date(),
      updatedAt: null
    }
    insert.push(message)
  }

  await collections(testDb).messages.insertMany(insert)

  let messages = await getMessages(testDb, roomId.toHexString())

  expect(messages.existHistory).toStrictEqual(true)
  expect(messages.messages.length).toStrictEqual(config.room.MESSAGE_LIMIT)

  messages = await getMessages(
    testDb,
    roomId.toHexString(),
    messages.messages[0].id
  )

  expect(messages.existHistory).toStrictEqual(true)
  expect(messages.messages.length).toStrictEqual(config.room.MESSAGE_LIMIT)

  messages = await getMessages(
    testDb,
    roomId.toHexString(),
    messages.messages[0].id
  )

  expect(messages.existHistory).toStrictEqual(false)
  expect(messages.messages.length).toStrictEqual(0)
})

test('getMessages vote', async ({ testDb }) => {
  const userId = new ObjectId()
  const account = 'test'
  await collections(testDb).users.insertOne({
    _id: userId,
    account,
    roomOrder: []
  })
  const roomId = new ObjectId()

  const insert: Omit<Message, '_id'>[] = []
  for (let i = 0; i < 10; i++) {
    const message: Omit<Message, '_id'> = {
      message: `${i}-message`,
      roomId,
      userId,
      iine: 0,
      updated: false,
      removed: false,
      createdAt: new Date(),
      updatedAt: null,
      vote: {
        questions: [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
        status: VoteStatusEnum.OPEN,
        type: VoteTypeEnum.CHOICE
      }
    }
    insert.push(message)
  }

  await collections(testDb).messages.insertMany(insert)

  const messages = await getMessages(testDb, roomId.toHexString())

  expect(messages.messages.length).toStrictEqual(10)

  for (const message of messages.messages) {
    expect(message.vote?.questions.length).toStrictEqual(3)
    expect(message.vote?.status).toStrictEqual(VoteStatusEnum.OPEN)
  }
})

test('getMessages removed', async ({ testDb }) => {
  const userId = new ObjectId()
  const account = 'test'
  await collections(testDb).users.insertOne({
    _id: userId,
    account,
    roomOrder: []
  })
  const roomId = new ObjectId()

  const insert: Omit<Message, '_id'>[] = []
  for (let i = 0; i < 10; i++) {
    const message: Omit<Message, '_id'> = {
      message: `${i}-message`,
      roomId,
      userId,
      iine: 0,
      updated: false,
      removed: true,
      createdAt: new Date(),
      updatedAt: null,
      vote: {
        questions: [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
        status: VoteStatusEnum.OPEN,
        type: VoteTypeEnum.CHOICE
      }
    }
    insert.push(message)
  }

  await collections(testDb).messages.insertMany(insert)

  const messages = await getMessages(testDb, roomId.toHexString())

  expect(messages.messages.length).toStrictEqual(10)

  for (const message of messages.messages) {
    expect(message.message).toStrictEqual('')
    expect(message.removed).toStrictEqual(true)
    expect(message.vote).toBeUndefined()
  }
})
