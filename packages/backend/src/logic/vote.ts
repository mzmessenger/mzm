import { ObjectId, type MongoClient } from 'mongodb'
import { MessageType } from 'mzm-shared/src/type/socket'
import {
  collections,
  COLLECTION_NAMES,
  type VoteAnswer,
  type User
} from '../lib/db.js'
import { createUserIconPath } from '../lib/utils.js'

export async function getVoteAnswers(db: MongoClient, messageId: ObjectId) {
  const answers: Exclude<MessageType['vote'], undefined>['answers'] = []

  const cursor = await collections(db).voteAnswer.aggregate<
    VoteAnswer & { user: User[] }
  >([
    {
      $match: {
        messageId: messageId
      }
    },
    {
      $lookup: {
        from: COLLECTION_NAMES.USERS,
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $sort: { _id: -1 }
    }
  ])

  for (
    let answer = await cursor.next();
    answer != null;
    answer = await cursor.next()
  ) {
    // Defensive: rows written before vote answer validation existed (or by a
    // future bug) must not break history reads for a whole room.
    if (
      !Number.isInteger(answer.index) ||
      typeof answer.answer !== 'number' ||
      !answer.userId
    ) {
      continue
    }
    const [answerUser] = answer.user
    if (!answerUser) {
      continue
    }
    answers.push({
      userId: answer.userId.toHexString(),
      userAccount: answerUser.account,
      icon: createUserIconPath(answerUser?.account, answerUser?.icon?.version),
      index: answer.index,
      answer: answer.answer
    })
  }

  return answers
}
