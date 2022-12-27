import type { MongoMemoryServer } from 'mongodb-memory-server'
import { vi, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
vi.mock('../lib/logger')

import { ObjectId } from 'mongodb'
import { VoteStatusEnum, VoteTypeEnum } from 'mzm-shared/type/db'
import { mongoSetup, dropCollection } from '../../test/testUtil'
import * as db from '../lib/db'
import { saveMessage, getMessages } from './messages'
import * as config from '../config'

let mongoServer: MongoMemoryServer | null = null
let mongoUri: string | null = null

beforeAll(async () => {
  const mongo = await mongoSetup()
  mongoServer = mongo.mongoServer
  mongoUri = mongo.uri
  await db.connect(mongo.uri)
})

afterAll(async () => {
  await db.close()
  await mongoServer?.stop()
})

beforeEach(async () => {
  if (mongoUri) {
    await dropCollection(mongoUri, db.COLLECTION_NAMES.MESSAGES)
  }
})

test('saveMessage', async () => {
  const message = 'test'
  const roomId = new ObjectId()
  const userId = new ObjectId()

  const save = await saveMessage(
    message,
    roomId.toHexString(),
    userId.toHexString()
  )

  if (!save) {
    expect(true).toStrictEqual(false)
    return
  }

  const found = await db.collections.messages.findOne({ _id: save.insertedId })

  expect(found?._id).toStrictEqual(save.insertedId)
  expect(found?.message).toStrictEqual(message)
  expect(found?.roomId.toHexString()).toStrictEqual(roomId.toHexString())
  expect(found?.userId.toHexString()).toStrictEqual(userId.toHexString())
})

test.each([[''], ['a'.repeat(config.message.MAX_MESSAGE_LENGTH + 1)]])(
  'valid: saveMessage (%s)',
  async (message) => {
    const roomId = new ObjectId()
    const userId = new ObjectId()

    const beforeCount = await db.collections.messages.countDocuments()

    const save = await saveMessage(
      message,
      roomId.toHexString(),
      userId.toHexString()
    )

    const afterCount = await db.collections.messages.countDocuments()

    expect(save).toStrictEqual(false)
    expect(beforeCount).toStrictEqual(afterCount)
  }
)

test('getMessages', async () => {
  const overNum = 2
  const userId = new ObjectId()
  const account = 'test'
  await db.collections.users.insertOne({ _id: userId, account, roomOrder: [] })
  const roomId = new ObjectId()

  const insert: Omit<db.Message, '_id'>[] = []
  for (let i = 0; i < config.room.MESSAGE_LIMIT + overNum; i++) {
    const message: Omit<db.Message, '_id'> = {
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

  await db.collections.messages.insertMany(insert)

  let messages = await getMessages(roomId.toHexString())

  const idList = messages.messages.map((message) => new ObjectId(message.id))
  const messageMap = (
    await db.collections.messages
      .find({
        _id: { $in: idList }
      })
      .toArray()
  ).reduce((map, current) => {
    map.set(current._id.toHexString(), current)
    return map
  }, new Map<string, db.Message>())

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

  messages = await getMessages(roomId.toHexString(), messages.messages[0].id)

  expect(messages.existHistory).toStrictEqual(false)
  expect(messages.messages.length).toStrictEqual(overNum)
})

test('getMessages just', async () => {
  const userId = new ObjectId()
  const account = 'test'
  await db.collections.users.insertOne({ _id: userId, account, roomOrder: [] })
  const roomId = new ObjectId()

  const insert: Omit<db.Message, '_id'>[] = []
  for (let i = 0; i < config.room.MESSAGE_LIMIT * 2; i++) {
    const message: Omit<db.Message, '_id'> = {
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

  await db.collections.messages.insertMany(insert)

  let messages = await getMessages(roomId.toHexString())

  expect(messages.existHistory).toStrictEqual(true)
  expect(messages.messages.length).toStrictEqual(config.room.MESSAGE_LIMIT)

  messages = await getMessages(roomId.toHexString(), messages.messages[0].id)

  expect(messages.existHistory).toStrictEqual(true)
  expect(messages.messages.length).toStrictEqual(config.room.MESSAGE_LIMIT)

  messages = await getMessages(roomId.toHexString(), messages.messages[0].id)

  expect(messages.existHistory).toStrictEqual(false)
  expect(messages.messages.length).toStrictEqual(0)
})

test('getMessages vote', async () => {
  const userId = new ObjectId()
  const account = 'test'
  await db.collections.users.insertOne({ _id: userId, account, roomOrder: [] })
  const roomId = new ObjectId()

  const insert: Omit<db.Message, '_id'>[] = []
  for (let i = 0; i < 10; i++) {
    const message: Omit<db.Message, '_id'> = {
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

  await db.collections.messages.insertMany(insert)

  const messages = await getMessages(roomId.toHexString())

  expect(messages.messages.length).toStrictEqual(10)

  for (const message of messages.messages) {
    expect(message.vote?.questions.length).toStrictEqual(3)
    expect(message.vote?.status).toStrictEqual(VoteStatusEnum.OPEN)
  }
})

test('getMessages removed', async () => {
  const userId = new ObjectId()
  const account = 'test'
  await db.collections.users.insertOne({ _id: userId, account, roomOrder: [] })
  const roomId = new ObjectId()

  const insert: Omit<db.Message, '_id'>[] = []
  for (let i = 0; i < 10; i++) {
    const message: Omit<db.Message, '_id'> = {
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

  await db.collections.messages.insertMany(insert)

  const messages = await getMessages(roomId.toHexString())

  expect(messages.messages.length).toStrictEqual(10)

  for (const message of messages.messages) {
    expect(message.message).toStrictEqual('')
    expect(message.removed).toStrictEqual(true)
    expect(message.vote).toBeUndefined()
  }
})
