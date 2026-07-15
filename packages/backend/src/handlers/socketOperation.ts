import { ObjectId, type ClientSession, type MongoClient } from 'mongodb'
import { z } from 'zod'
import {
  TO_CLIENT_CMD,
  TO_SERVER_CMD,
  type SocketToBackendType,
  type ToClientType
} from 'mzm-shared/src/type/socket'
import { VoteStatusEnum, VoteTypeEnum } from 'mzm-shared/src/type/db'
import { collections, RoomStatusEnum, VoteAnswerEnum, type VoteAnswer } from '../lib/db.js'
import { createSocketOperation } from '../lib/outbox.js'
import { createUserIconPath, escape, repliedAccounts, unescape } from '../lib/utils.js'

const keyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function messageEvent(users: string[], message: ToClientType, emit: (event: { type: 'message'; payload: ToClientType; orderingKey: string }) => void) {
  for (const user of users) emit({ type: 'message', payload: { ...message, user }, orderingKey: `user:${user}` })
}

function isVoteAnswer(answer: number): answer is VoteAnswer['answer'] {
  return Object.values<number>(VoteAnswerEnum).includes(answer)
}

async function roomUsers(db: MongoClient, roomId: ObjectId, session: ClientSession) {
  const entries = await collections(db).enter.find({ roomId }, { session }).toArray()
  return entries.map((entry) => entry.userId.toHexString())
}

export async function executeSocketOperation({ db, subject, idempotencyKey, data }: { db: MongoClient; subject: string; idempotencyKey: string; data: SocketToBackendType }) {
  if (!keyPattern.test(idempotencyKey)) throw new Error('invalid idempotency key')
  return await createSocketOperation({
    db,
    subject,
    idempotencyKey,
    request: data,
    async run({ session, emit }) {
      if (data.cmd === TO_SERVER_CMD.MESSAGE_SEND) {
        const parsed = z.object({ message: z.string().min(1), room: z.string().min(1), vote: z.object({ questions: z.array(z.object({ text: z.string().min(1) })) }).optional() }).safeParse(data)
        if (!parsed.success) return undefined
        const text = escape(parsed.data.message.trim())
        const room = escape(parsed.data.room.trim())
        if (!text || !room) return undefined
        const vote = parsed.data.vote ? { questions: parsed.data.vote.questions.map((question) => ({ text: question.text })), status: VoteStatusEnum.OPEN, type: VoteTypeEnum.CHOICE } : undefined
        const saved = await collections(db).messages.insertOne({ message: text, roomId: new ObjectId(room), userId: new ObjectId(subject), iine: 0, updated: false, removed: false, createdAt: new Date(), updatedAt: null, ...(vote ? { vote } : {}) }, { session })
        const user = await collections(db).users.findOne({ _id: new ObjectId(subject) }, { session })
        if (!user) return undefined
        const send: ToClientType = { user: null, cmd: TO_CLIENT_CMD.MESSAGE_RECEIVE, message: { id: saved.insertedId.toHexString(), userId: subject, userAccount: user.account, message: unescape(text), iine: 0, updated: false, removed: false, createdAt: Date.now().toString(), updatedAt: null, icon: createUserIconPath(user.account, user.icon?.version) }, room }
        if (vote) send.message.vote = { questions: vote.questions, answers: [], status: VoteStatusEnum.OPEN }
        emit({ type: 'unread', payload: { roomId: room, messageId: saved.insertedId.toHexString() }, orderingKey: `room:${room}` })
        const accounts = repliedAccounts(text)
        if (accounts.length > 0) {
          const repliedUsers = await collections(db).users.find({ account: { $in: accounts } }, { session }).toArray()
          for (const repliedUser of repliedUsers) emit({ type: 'reply', payload: { roomId: room, userId: repliedUser._id.toHexString() }, orderingKey: `user:${repliedUser._id.toHexString()}` })
        }
        messageEvent(await roomUsers(db, new ObjectId(room), session), send, emit)
        return send
      }
      if (data.cmd === TO_SERVER_CMD.MESSAGE_IINE) {
        const target = await collections(db).messages.findOne({ _id: new ObjectId(data.id) }, { session })
        if (!target) return undefined
        await collections(db).messages.updateOne({ _id: target._id }, { $inc: { iine: 1 } }, { session })
        const send: ToClientType = { cmd: TO_CLIENT_CMD.MESSAGE_IINE, iine: target.iine + 1, room: target.roomId.toHexString(), id: target._id.toHexString() }
        messageEvent(await roomUsers(db, target.roomId, session), send, emit)
        return send
      }
      if (data.cmd === TO_SERVER_CMD.MESSAGE_MODIFY || data.cmd === TO_SERVER_CMD.MESSAGE_REMOVE) {
        const target = await collections(db).messages.findOne({ _id: new ObjectId(data.id) }, { session })
        if (!target || target.userId.toHexString() !== subject || target.removed) return undefined
        const updatedAt = new Date()
        const isRemove = data.cmd === TO_SERVER_CMD.MESSAGE_REMOVE
        const text = isRemove ? '' : escape(data.message.trim())
        if (!isRemove && !text) return undefined
        await collections(db).messages.updateOne({ _id: target._id }, { $set: isRemove ? { removed: true, updatedAt } : { message: text, updated: true, updatedAt } }, { session })
        const user = await collections(db).users.findOne({ _id: new ObjectId(subject) }, { session })
        if (!user) return undefined
        const send: ToClientType = { user: subject, cmd: isRemove ? TO_CLIENT_CMD.MESSAGE_REMOVE : TO_CLIENT_CMD.MESSAGE_MODIFY, message: { id: target._id.toHexString(), message: unescape(text), iine: target.iine, userId: subject, userAccount: user.account, updated: isRemove ? target.updated : true, removed: isRemove, createdAt: target.createdAt.getTime().toString(), updatedAt: updatedAt.getTime().toString(), icon: createUserIconPath(user.account, user.icon?.version) }, room: target.roomId.toHexString() }
        messageEvent(await roomUsers(db, target.roomId, session), send, emit)
        return send
      }
      if (data.cmd === TO_SERVER_CMD.ROOMS_READ) {
        if (!data.room) return undefined
        await collections(db).enter.updateOne({ userId: new ObjectId(subject), roomId: new ObjectId(data.room) }, { $set: { unreadCounter: 0, replied: 0 } }, { session })
        const send = { user: subject, cmd: TO_CLIENT_CMD.ROOMS_READ, room: data.room }
        emit({ type: 'message', payload: send, orderingKey: `user:${subject}` })
        return send
      }
      if (data.cmd === TO_SERVER_CMD.ROOMS_SORT) {
        if (!Array.isArray(data.roomOrder) || !data.roomOrder.every((room) => typeof room === 'string')) return undefined
        await collections(db).users.updateOne({ _id: new ObjectId(subject) }, { $set: { roomOrder: data.roomOrder } }, { session })
        const send = { user: subject, cmd: TO_CLIENT_CMD.ROOMS_SORT_SUCCESS, roomOrder: data.roomOrder }
        emit({ type: 'message', payload: send, orderingKey: `user:${subject}` })
        return send
      }
      if (data.cmd === TO_SERVER_CMD.ROOMS_UPDATE_DESCRIPTION) {
        if (!data.roomId || !data.description || data.description.length > 5000) return undefined
        const roomId = new ObjectId(data.roomId)
        await collections(db).rooms.updateOne({ _id: roomId }, { $set: { description: data.description, updatedBy: new ObjectId(subject) } }, { session })
        const send: ToClientType = { cmd: TO_CLIENT_CMD.ROOMS_UPDATE_DESCRIPTION, roomId: data.roomId, descrioption: data.description }
        messageEvent(await roomUsers(db, roomId, session), send, emit)
        return send
      }
      if (data.cmd === TO_SERVER_CMD.VOTE_ANSWER_SEND || data.cmd === TO_SERVER_CMD.VOTE_ANSWER_REMOVE) {
        const messageId = new ObjectId(data.messageId)
        const target = await collections(db).messages.findOne({ _id: messageId }, { session })
        if (!target?.vote || target.vote.status !== VoteStatusEnum.OPEN) return undefined
        if (data.cmd === TO_SERVER_CMD.VOTE_ANSWER_SEND) {
          if (!isVoteAnswer(data.answer) || data.answer > target.vote.questions.length) return undefined
          await collections(db).voteAnswer.updateOne({ messageId, userId: new ObjectId(subject), index: data.index }, { $set: { answer: data.answer } }, { upsert: true, session })
        } else {
          await collections(db).voteAnswer.deleteOne({ messageId, userId: new ObjectId(subject), index: data.index }, { session })
        }
        emit({ type: 'vote', payload: { messageId: data.messageId }, orderingKey: `message:${data.messageId}` })
        return undefined
      }
      if (data.cmd === TO_SERVER_CMD.ROOMS_OPEN || data.cmd === TO_SERVER_CMD.ROOMS_CLOSE) {
        const roomId = new ObjectId(data.roomId)
        await collections(db).rooms.updateOne({ _id: roomId }, { $set: { status: data.cmd === TO_SERVER_CMD.ROOMS_OPEN ? RoomStatusEnum.OPEN : RoomStatusEnum.CLOSE, updatedBy: new ObjectId(subject) } }, { session })
      }
      return undefined
    }
  })
}
