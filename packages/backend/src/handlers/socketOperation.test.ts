import { expect } from 'vitest'
import { ObjectId } from 'mongodb'
import { VoteStatusEnum, VoteTypeEnum } from 'mzm-shared/src/type/db'
import type { QueueEventType } from 'mzm-shared/src/lib/queue'
import { TO_CLIENT_CMD, TO_SERVER_CMD } from 'mzm-shared/src/type/socket'
import { createTest } from '../../test/testUtil.js'
import { collections, RoomStatusEnum } from '../lib/db.js'
import { initializeOutboxIndexes, outbox } from '../lib/db/outbox.js'
import {
  executeSocketOperation,
  type SocketOperationData
} from './socketOperation.js'

const test = await createTest(globalThis)

test('rooms:get answers the requester directly without a queue event', async ({
  testDb
}) => {
  await initializeOutboxIndexes(testDb)

  const userId = new ObjectId()
  const roomId = new ObjectId()
  await Promise.all([
    collections(testDb).users.insertOne({
      _id: userId,
      account: `user-${userId.toHexString()}`,
      roomOrder: [roomId.toHexString()]
    }),
    collections(testDb).rooms.insertOne({
      _id: roomId,
      name: `room-${roomId.toHexString()}`,
      createdBy: userId.toHexString(),
      status: RoomStatusEnum.OPEN
    }),
    collections(testDb).enter.insertOne({
      userId,
      roomId,
      unreadCounter: 0,
      replied: 0
    })
  ])

  const operation = await executeSocketOperation({
    db: testDb,
    subject: userId.toHexString(),
    idempotencyKey: crypto.randomUUID(),
    data: { cmd: TO_SERVER_CMD.ROOMS_GET }
  })

  expect(operation.response).toMatchObject({
    cmd: TO_CLIENT_CMD.ROOMS_GET,
    user: userId.toHexString(),
    roomOrder: [roomId.toHexString()],
    rooms: [{ id: roomId.toHexString() }]
  })
  // Read commands bypass the outbox: the response above is the delivery.
  expect(await outbox(testDb).countDocuments({})).toBe(0)
})

test('messages:room answers the requester directly without a queue event', async ({
  testDb
}) => {
  await initializeOutboxIndexes(testDb)

  const userId = new ObjectId()
  const roomId = new ObjectId()
  const messageId = new ObjectId()
  await Promise.all([
    collections(testDb).users.insertOne({
      _id: userId,
      account: `user-${userId.toHexString()}`,
      roomOrder: [roomId.toHexString()]
    }),
    collections(testDb).rooms.insertOne({
      _id: roomId,
      name: `room-${roomId.toHexString()}`,
      createdBy: userId.toHexString(),
      status: RoomStatusEnum.OPEN
    }),
    collections(testDb).enter.insertOne({
      userId,
      roomId,
      unreadCounter: 0,
      replied: 0
    }),
    collections(testDb).messages.insertOne({
      _id: messageId,
      userId,
      roomId,
      message: 'hello',
      iine: 0,
      updated: false,
      removed: false,
      createdAt: new Date(),
      updatedAt: null
    })
  ])

  const operation = await executeSocketOperation({
    db: testDb,
    subject: userId.toHexString(),
    idempotencyKey: crypto.randomUUID(),
    data: {
      cmd: TO_SERVER_CMD.MESSAGES_ROOM,
      room: roomId.toHexString()
    }
  })

  expect(operation.response).toMatchObject({
    cmd: TO_CLIENT_CMD.MESSAGES_ROOM,
    user: userId.toHexString(),
    room: roomId.toHexString(),
    messages: [{ id: messageId.toHexString(), message: 'hello' }]
  })
  // Read commands bypass the outbox: the response above is the delivery.
  expect(await outbox(testDb).countDocuments({})).toBe(0)
})

test('rooms:enter adds the user and emits the entered room', async ({
  testDb
}) => {
  await initializeOutboxIndexes(testDb)

  const userId = new ObjectId()
  const roomId = new ObjectId()
  await Promise.all([
    collections(testDb).users.insertOne({
      _id: userId,
      account: `user-${userId.toHexString()}`,
      roomOrder: []
    }),
    collections(testDb).rooms.insertOne({
      _id: roomId,
      name: `room-${roomId.toHexString()}`,
      description: 'room description',
      createdBy: userId.toHexString(),
      status: RoomStatusEnum.OPEN
    })
  ])

  const operation = await executeSocketOperation({
    db: testDb,
    subject: userId.toHexString(),
    idempotencyKey: crypto.randomUUID(),
    data: {
      cmd: TO_SERVER_CMD.ROOMS_ENTER,
      id: roomId.toHexString()
    }
  })

  expect(operation.response).toMatchObject({
    cmd: TO_CLIENT_CMD.ROOMS_ENTER_SUCCESS,
    user: userId.toHexString(),
    id: roomId.toHexString(),
    description: 'room description'
  })
  expect(
    await collections(testDb).enter.findOne({ userId, roomId })
  ).not.toBeNull()
  const event = await outbox(testDb).findOne({
    _id: `${operation.operationId}:0`
  })
  expect(event?.payload).toMatchObject({
    cmd: TO_CLIENT_CMD.ROOMS_ENTER_SUCCESS,
    user: userId.toHexString(),
    id: roomId.toHexString()
  })
})

test('every POST socket command has an explicit response and outbox contract', async ({
  testDb
}) => {
  await initializeOutboxIndexes(testDb)

  const userId = new ObjectId()
  const roomId = new ObjectId()
  const messageId = new ObjectId()
  await Promise.all([
    collections(testDb).users.insertOne({
      _id: userId,
      account: `user-${userId.toHexString()}`,
      roomOrder: [roomId.toHexString()]
    }),
    collections(testDb).rooms.insertOne({
      _id: roomId,
      name: `room-${roomId.toHexString()}`,
      createdBy: userId.toHexString(),
      status: RoomStatusEnum.OPEN
    }),
    collections(testDb).enter.insertOne({
      userId,
      roomId,
      unreadCounter: 0,
      replied: 0
    }),
    collections(testDb).messages.insertOne({
      _id: messageId,
      userId,
      roomId,
      message: 'contract message',
      iine: 0,
      updated: false,
      removed: false,
      createdAt: new Date(),
      updatedAt: null,
      vote: {
        questions: [{ text: 'question' }],
        status: VoteStatusEnum.OPEN,
        type: VoteTypeEnum.CHOICE
      }
    })
  ])

  const contracts = [
    {
      data: { cmd: TO_SERVER_CMD.ROOMS_GET },
      response: TO_CLIENT_CMD.ROOMS_GET,
      events: []
    },
    {
      data: { cmd: TO_SERVER_CMD.ROOMS_ENTER, id: roomId.toHexString() },
      response: TO_CLIENT_CMD.ROOMS_ENTER_SUCCESS,
      events: ['message']
    },
    {
      data: { cmd: TO_SERVER_CMD.ROOMS_READ, room: roomId.toHexString() },
      response: TO_CLIENT_CMD.ROOMS_READ,
      events: []
    },
    {
      data: {
        cmd: TO_SERVER_CMD.ROOMS_SORT,
        roomOrder: [roomId.toHexString()]
      },
      response: TO_CLIENT_CMD.ROOMS_SORT_SUCCESS,
      events: []
    },
    {
      data: { cmd: TO_SERVER_CMD.ROOMS_OPEN, roomId: roomId.toHexString() },
      response: null,
      events: []
    },
    {
      data: { cmd: TO_SERVER_CMD.ROOMS_CLOSE, roomId: roomId.toHexString() },
      response: null,
      events: []
    },
    {
      data: {
        cmd: TO_SERVER_CMD.ROOMS_UPDATE_DESCRIPTION,
        roomId: roomId.toHexString(),
        description: 'updated'
      },
      response: TO_CLIENT_CMD.ROOMS_UPDATE_DESCRIPTION,
      events: ['message']
    },
    {
      data: {
        cmd: TO_SERVER_CMD.MESSAGE_SEND,
        room: roomId.toHexString(),
        message: 'sent message'
      },
      response: TO_CLIENT_CMD.MESSAGE_RECEIVE,
      events: ['unread', 'message']
    },
    {
      data: { cmd: TO_SERVER_CMD.MESSAGE_IINE, id: messageId.toHexString() },
      response: TO_CLIENT_CMD.MESSAGE_IINE,
      events: ['message']
    },
    {
      data: {
        cmd: TO_SERVER_CMD.MESSAGE_MODIFY,
        id: messageId.toHexString(),
        message: 'modified'
      },
      response: TO_CLIENT_CMD.MESSAGE_MODIFY,
      events: ['message']
    },
    {
      data: {
        cmd: TO_SERVER_CMD.MESSAGES_ROOM,
        room: roomId.toHexString()
      },
      response: TO_CLIENT_CMD.MESSAGES_ROOM,
      events: []
    },
    {
      data: {
        cmd: TO_SERVER_CMD.VOTE_ANSWER_SEND,
        messageId: messageId.toHexString(),
        index: 0,
        answer: 1
      },
      response: null,
      events: ['vote']
    },
    {
      data: {
        cmd: TO_SERVER_CMD.VOTE_ANSWER_REMOVE,
        messageId: messageId.toHexString(),
        index: 0
      },
      response: null,
      events: ['vote']
    },
    {
      data: {
        cmd: TO_SERVER_CMD.MESSAGE_REMOVE,
        id: messageId.toHexString()
      },
      response: TO_CLIENT_CMD.MESSAGE_REMOVE,
      events: ['message']
    }
  ] as const satisfies readonly {
    data: SocketOperationData
    response: string | null
    events: readonly QueueEventType[]
  }[]

  expect(contracts.map((contract) => contract.data.cmd).sort()).toEqual(
    Object.values(TO_SERVER_CMD)
      .filter((command) => command !== TO_SERVER_CMD.CONNECTION)
      .sort()
  )

  for (const contract of contracts) {
    const operation = await executeSocketOperation({
      db: testDb,
      subject: userId.toHexString(),
      idempotencyKey: crypto.randomUUID(),
      data: contract.data
    })
    expect(
      operation.response && typeof operation.response === 'object'
        ? operation.response.cmd
        : operation.response
    ).toBe(contract.response)
    const events = await outbox(testDb)
      .find({ operationId: new ObjectId(operation.operationId) })
      .sort({ eventIndex: 1 })
      .toArray()
    expect(events.map((event) => event.type)).toEqual(contract.events)
  }
})

test('general room status is not changed by rooms:open or rooms:close', async ({
  testDb
}) => {
  await initializeOutboxIndexes(testDb)

  const userId = new ObjectId()
  const generalId = new ObjectId()
  await Promise.all([
    collections(testDb).users.insertOne({
      _id: userId,
      account: `user-${userId.toHexString()}`,
      roomOrder: []
    }),
    collections(testDb).rooms.insertOne({
      _id: generalId,
      name: 'general',
      createdBy: userId.toHexString(),
      status: RoomStatusEnum.OPEN
    })
  ])

  const close = await executeSocketOperation({
    db: testDb,
    subject: userId.toHexString(),
    idempotencyKey: crypto.randomUUID(),
    data: { cmd: TO_SERVER_CMD.ROOMS_CLOSE, roomId: generalId.toHexString() }
  })
  expect(close.response).toBeNull()

  const open = await executeSocketOperation({
    db: testDb,
    subject: userId.toHexString(),
    idempotencyKey: crypto.randomUUID(),
    data: { cmd: TO_SERVER_CMD.ROOMS_OPEN, roomId: generalId.toHexString() }
  })
  expect(open.response).toBeNull()

  const general = await collections(testDb).rooms.findOne({ _id: generalId })
  expect(general?.status).toBe(RoomStatusEnum.OPEN)
})

test('vote answers reject a non-integer index and out-of-range values', async ({
  testDb
}) => {
  await initializeOutboxIndexes(testDb)

  const userId = new ObjectId()
  const roomId = new ObjectId()
  const messageId = new ObjectId()
  await Promise.all([
    collections(testDb).users.insertOne({
      _id: userId,
      account: `user-${userId.toHexString()}`,
      roomOrder: []
    }),
    collections(testDb).rooms.insertOne({
      _id: roomId,
      name: `room-${roomId.toHexString()}`,
      createdBy: userId.toHexString(),
      status: RoomStatusEnum.OPEN
    }),
    collections(testDb).messages.insertOne({
      _id: messageId,
      userId,
      roomId,
      message: 'vote message',
      iine: 0,
      updated: false,
      removed: false,
      createdAt: new Date(),
      updatedAt: null,
      vote: {
        questions: [{ text: 'question' }],
        status: VoteStatusEnum.OPEN,
        type: VoteTypeEnum.CHOICE
      }
    }),
    collections(testDb).enter.insertOne({
      userId,
      roomId,
      unreadCounter: 0,
      replied: 0
    })
  ])

  const run = (data: Record<string, unknown>) =>
    executeSocketOperation({
      db: testDb,
      subject: userId.toHexString(),
      idempotencyKey: crypto.randomUUID(),
      data: data as SocketOperationData
    })

  expect((await run({ cmd: TO_SERVER_CMD.VOTE_ANSWER_SEND, messageId: messageId.toHexString(), index: 'x', answer: 0 })).response).toBeNull()
  expect((await run({ cmd: TO_SERVER_CMD.VOTE_ANSWER_SEND, messageId: messageId.toHexString(), index: 1, answer: 0 })).response).toBeNull()
  expect((await run({ cmd: TO_SERVER_CMD.VOTE_ANSWER_SEND, messageId: messageId.toHexString(), index: 0, answer: 3 })).response).toBeNull()
  expect(await collections(testDb).voteAnswer.countDocuments({ messageId })).toBe(0)

  // A previously saved invalid row must not break later reads.
  await collections(testDb).voteAnswer.insertOne({
    messageId,
    userId,
    index: 'x' as unknown as number,
    answer: 0
  })
  const history = await executeSocketOperation({
    db: testDb,
    subject: userId.toHexString(),
    idempotencyKey: crypto.randomUUID(),
    data: { cmd: TO_SERVER_CMD.MESSAGES_ROOM, room: roomId.toHexString() }
  })
  expect(history.response).toMatchObject({ cmd: TO_CLIENT_CMD.MESSAGES_ROOM })
})

test('message text keeps the 3000 character bound', async ({ testDb }) => {
  await initializeOutboxIndexes(testDb)

  const userId = new ObjectId()
  const roomId = new ObjectId()
  await Promise.all([
    collections(testDb).users.insertOne({
      _id: userId,
      account: `user-${userId.toHexString()}`,
      roomOrder: []
    }),
    collections(testDb).rooms.insertOne({
      _id: roomId,
      name: `room-${roomId.toHexString()}`,
      createdBy: userId.toHexString(),
      status: RoomStatusEnum.OPEN
    }),
    collections(testDb).enter.insertOne({
      userId,
      roomId,
      unreadCounter: 0,
      replied: 0
    })
  ])

  const tooLong = await executeSocketOperation({
    db: testDb,
    subject: userId.toHexString(),
    idempotencyKey: crypto.randomUUID(),
    data: {
      cmd: TO_SERVER_CMD.MESSAGE_SEND,
      room: roomId.toHexString(),
      message: 'あ'.repeat(3001)
    }
  })
  expect(tooLong.response).toBeNull()
  expect(await collections(testDb).messages.countDocuments({ roomId })).toBe(0)

  const maxLen = await executeSocketOperation({
    db: testDb,
    subject: userId.toHexString(),
    idempotencyKey: crypto.randomUUID(),
    data: {
      cmd: TO_SERVER_CMD.MESSAGE_SEND,
      room: roomId.toHexString(),
      message: 'あ'.repeat(3000)
    }
  })
  expect(maxLen.response && typeof maxLen.response === 'object' ? maxLen.response.cmd : null).toBe(TO_CLIENT_CMD.MESSAGE_RECEIVE)
  expect(await collections(testDb).messages.countDocuments({ roomId })).toBe(1)
})
