import { ObjectId, type WithId, type Document } from 'mongodb'
import { MessageType } from 'mzm-shared/src/type/socket'
import * as config from '../config.js'
import {
  collections,
  mongoClient,
  COLLECTION_NAMES,
  type Message,
  type User
} from '../lib/db.js'
import { createUserIconPath, unescape } from '../lib/utils.js'
import { getVoteAnswers } from './vote.js'

export const saveMessage = async (
  message: string,
  roomId: string,
  userId: string,
  vote?: Message['vote']
) => {
  if (
    message.length > config.message.MAX_MESSAGE_LENGTH ||
    message.length < config.message.MIN_MESSAGE_LENGTH
  ) {
    return false
  }

  const insert: Omit<Message, '_id'> = {
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
  return await collections(await mongoClient()).messages.insertOne(insert)
}

export const getMessages = async (
  roomId: string,
  thresholdId?: string
): Promise<{ existHistory: boolean; messages: MessageType[] }> => {
  const query: Document[] = [
    {
      $match: { roomId: new ObjectId(roomId) }
    },
    {
      $lookup: {
        from: COLLECTION_NAMES.USERS,
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

  type AggregateType = WithId<Message> & {
    user: WithId<User>[]
  }

  const db = await mongoClient()
  const cursor = await collections(db)
    .messages.aggregate<AggregateType>(query)
    .sort({ _id: -1 })
    .limit(config.room.MESSAGE_LIMIT)

  const messages: MessageType[] = []
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const [user] = doc.user
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
      userAccount: user.account,
      icon: createUserIconPath(user?.account, user?.icon?.version)
    }

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
