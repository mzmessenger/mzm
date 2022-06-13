import { ObjectId } from 'mongodb'
import { MessageType } from 'mzm-shared/type/socket'
import * as db from '../lib/db.js'
import { createUserIconPath } from '../lib/utils.js'

export const getVoteAnswers = async (messageId: ObjectId) => {
  const answers: MessageType['vote']['answers'] = []

  const cursor = await db.collections.voteAnswer.aggregate<
    db.VoteAnswer & { user: db.User[] }
  >([
    {
      $match: {
        messageId: messageId
      }
    },
    {
      $lookup: {
        from: db.COLLECTION_NAMES.USERS,
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
    const [answerUser] = answer.user
    answers.push({
      userId: answer.userId.toHexString(),
      userAccount: answerUser?.account || null,
      icon: createUserIconPath(answerUser?.account, answerUser?.icon?.version),
      index: answer.index,
      answer: answer.answer
    })
  }

  return answers
}
