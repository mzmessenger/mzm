/* eslint-disable @typescript-eslint/ban-ts-comment */
import { vi, expect } from 'vitest'
import { createTest } from '../../../test/testUtil.js'
vi.mock('../../lib/logger.js')
vi.mock('../../logic/messages.js')
vi.mock('../../lib/provider/index.js')

import { ObjectId } from 'mongodb'
import { VoteStatusEnum, VoteTypeEnum } from 'mzm-shared/src/type/db'
import {
  TO_SERVER_CMD,
  FilterSocketToBackendType
} from 'mzm-shared/src/type/socket'
import { collections, VoteAnswerEnum, type Message } from '../../lib/db.js'
import { sendVoteAnswer } from './socket.js'

const baseTest = await createTest(globalThis)
const test = baseTest.extend<{
  message: {
    messageId: ObjectId
    userId: ObjectId
  }
}>({
  message: async ({ testDb }, use) => {
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
    const messageId = message.insertedId
    await use({ messageId, userId })
  }
})

test('[sendVoteAnswer:BadRequest]: no messageId', async ({
  testDb,
  testRedis,
  message
}) => {
  const before = await collections(testDb)
    .voteAnswer.find({ messageId: message.messageId })
    .toArray()

  await sendVoteAnswer({
    db: testDb,
    redis: testRedis,
    user: message.userId.toHexString(),
    data: {
      cmd: TO_SERVER_CMD.VOTE_ANSWER_SEND,
      index: 0,
      answer: VoteAnswerEnum.OK
    } as FilterSocketToBackendType<typeof TO_SERVER_CMD.VOTE_ANSWER_SEND>
  })

  const after = await collections(testDb)
    .voteAnswer.find({ messageId: message.messageId })
    .toArray()

  expect(before.length).toStrictEqual(after.length)
})

test.for([
  ['no index', TO_SERVER_CMD.VOTE_ANSWER_SEND, VoteAnswerEnum.OK, undefined],
  ['no index', TO_SERVER_CMD.VOTE_ANSWER_SEND, VoteAnswerEnum.OK, null]
] as const)(
  '[sendVoteAnswer:BadRequest]: %s',
  async ([, cmd, answer, index], { testDb, testRedis, message }) => {
    await sendVoteAnswer({
      db: testDb,
      redis: testRedis,
      user: message.userId.toHexString(),
      data: {
        messageId: message.messageId.toHexString(),
        cmd,
        answer,
        // @ts-expect-error
        index
      }
    })

    const answers = await collections(testDb)
      .voteAnswer.find({
        messageId: message.messageId
      })
      .toArray()

    expect(answers.length).toStrictEqual(0)
  }
)
