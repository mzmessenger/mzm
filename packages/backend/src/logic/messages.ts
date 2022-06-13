import { ObjectId, WithId } from 'mongodb'
import unescape from 'validator/lib/unescape'
import { MessageType } from 'mzm-shared/type/socket'
import * as config from '../config'
import * as db from '../lib/db'
import { createUserIconPath } from '../lib/utils'
import { getVoteAnswers } from './vote'

export const saveMessage = async (
  message: string,
  roomId: string,
  userId: string,
  vote?: db.Message['vote']
) => {
  if (
    message.length > config.message.MAX_MESSAGE_LENGTH ||
    message.length < config.message.MIN_MESSAGE_LENGTH
  ) {
    return false
  }

  const insert: Omit<db.Message, '_id'> = {
    message: message,
    roomId: new ObjectId(roomId),
    userId: new ObjectId(userId),
    iine: 0,
    updated: false,
    removed: false,
    createdAt: new Date(),
    updatedAt: null
  }
  if (vote) {
    insert.vote = vote
  }
  return await db.collections.messages.insertOne(insert)
}

export const getMessages = async (
  roomId: string,
  thresholdId?: string
): Promise<{ existHistory: boolean; messages: MessageType[] }> => {
  const query: Object[] = [
    {
      $match: { roomId: new ObjectId(roomId) }
    },
    {
      $lookup: {
        from: db.COLLECTION_NAMES.USERS,
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    }
  ]

  if (thresholdId) {
    query.push({
      $match: { _id: { $lt: new ObjectId(thresholdId) } }
    })
  }

  type AggregateType = WithId<db.Message> & {
    user: WithId<db.User>[]
  }

  const cursor = await db.collections.messages
    .aggregate<AggregateType>(query)
    .sort({ _id: -1 })
    .limit(config.room.MESSAGE_LIMIT)

  const messages: MessageType[] = []
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const [user] = doc.user
    // @todo write test
    const messageStr = doc.removed ? '' : unescape(doc.message)
    const message: MessageType = {
      id: doc._id.toHexString(),
      message: messageStr,
      iine: doc.iine ? doc.iine : 0,
      userId: doc.userId.toHexString(),
      updated: doc.updated ? doc.updated : false,
      removed: doc.removed ? doc.removed : false,
      createdAt: doc.createdAt.getTime().toString(),
      updatedAt: doc.updatedAt ? doc.updatedAt.getTime().toString() : null,
      userAccount: user ? user.account : null,
      icon: createUserIconPath(user?.account, user?.icon?.version)
    }

    // @todo write test
    if (!doc.removed && doc.vote) {
      const questions = doc.vote.questions.map((q) => {
        return { text: q.text }
      })

      const answers = await getVoteAnswers(doc._id)

      message.vote = {
        questions,
        answers,
        status: doc.vote.status
      }
    }

    messages.unshift(message)
  }

  return {
    existHistory: messages.length >= config.room.MESSAGE_LIMIT,
    messages
  }
}
