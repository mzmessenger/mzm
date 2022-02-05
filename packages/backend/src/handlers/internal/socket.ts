import { ObjectId, WithId } from 'mongodb'
import escape from 'validator/lib/escape'
import unescape from 'validator/lib/unescape'
import trim from 'validator/lib/trim'
import isEmpty from 'validator/lib/isEmpty'
import isNumeric from 'validator/lib/isNumeric'
import { SendMessage as SendMessageType } from '../../types'
import * as db from '../../lib/db'
import * as config from '../../config'
import {
  popParam,
  createUserIconPath,
  createRoomIconPath,
  repliedAccounts
} from '../../lib/utils'
import {
  addMessageQueue,
  addQueueToUsers,
  addUnreadQueue,
  addRepliedQueue,
  addUpdateSearchRoomQueue,
  addVoteQueue
} from '../../lib/provider/index'
import { saveMessage, getMessages } from '../../logic/messages'
import {
  getAllUserIdsInRoom,
  getRooms as getRoomsLogic
} from '../../logic/users'
import {
  isValidateRoomName,
  createRoom,
  enterRoom as logicEnterRoom
} from '../../logic/rooms'

export const ReceiveMessageCmd = {
  CONNECTION: 'socket:connection',
  ROOMS_GET: 'rooms:get',
  ROOMS_ENTER: 'rooms:enter',
  ROOMS_READ: 'rooms:read',
  ROOMS_SORT: 'rooms:sort',
  ROOMS_OPEN: 'rooms:open',
  ROOMS_CLOSE: 'rooms:close',
  MESSAGE_SEND: 'message:send',
  MESSAGE_IINE: 'message:iine',
  MESSAGE_MODIFY: 'message:modify',
  MESSAGES_ROOM: 'messages:room',
  VOTE_ANSWER_SEND: 'vote:answer:send',
  VOTE_ANSWER_REMOVE: 'vote:answer:remove'
} as const

export type ReceiveMessage =
  | ConnectionMessage
  | { cmd: typeof ReceiveMessageCmd.ROOMS_GET }
  | SendMessage
  | ModifyMessage
  | IineMessage
  | GetMessages
  | EnterRoom
  | ReadMessage
  | SortRooms
  | OpenRoom
  | CloseRoom
  | SendVoteAnswer
  | RemoveVoteAnswer

type ConnectionMessage = {
  cmd: typeof ReceiveMessageCmd.CONNECTION
  payload: { user: string }
}

export const connection = (userId: string, _data: ConnectionMessage) => {
  return {
    cmd: 'socket:connection',
    user: userId
  }
}

export const getRooms = async (userId: string): Promise<SendMessageType> => {
  const [user, rooms] = await Promise.all([
    db.collections.users.findOne<Pick<db.User, 'roomOrder'>>(
      { _id: new ObjectId(userId) },
      { projection: { roomOrder: 1 } }
    ),
    getRoomsLogic(userId)
  ])
  const room: SendMessageType = {
    user: userId,
    cmd: 'rooms',
    rooms,
    roomOrder: user.roomOrder ? user.roomOrder : []
  }
  return room
}

type SendMessage = {
  cmd: typeof ReceiveMessageCmd.MESSAGE_SEND
  message: string
  room: string
  vote?: {
    questions: {
      text: string
    }[]
  }
}

export const sendMessage = async (user: string, data: SendMessage) => {
  const message = escape(trim(data.message))
  const room = escape(trim(data.room))
  // todo: send bad request
  if (isEmpty(message) || isEmpty(room)) {
    return
  }

  // アンケート
  let vote: db.Message['vote'] = null
  if (data.vote) {
    let length = 0
    const questions = []
    for (const q of data.vote.questions) {
      if (
        isEmpty(q.text) ||
        q.text.length > config.vote.MAX_QUESTION_LENGTH ||
        length > config.vote.MAX_QUESTION_NUM
      ) {
        // todo: send bad request
        return
      }
      questions.push({ text: q.text })
      length += 1
    }
    vote = {
      questions,
      status: db.VoteStatusEnum.OPEN,
      type: db.VoteTypeEnum.CHOICE
    }
  }

  const saved = await saveMessage(message, room, user, vote)

  if (!saved) {
    return
  }

  const u = await db.collections.users.findOne({
    _id: new ObjectId(user)
  })
  const send: SendMessageType = {
    user: null,
    cmd: 'message:receive',
    message: {
      id: saved.insertedId.toHexString(),
      userId: user,
      userAccount: u.account,
      message: unescape(message),
      iine: 0,
      updated: false,
      createdAt: new Date(Date.now()),
      updatedAt: null,
      icon: createUserIconPath(u.account, u.icon?.version)
    },
    room: room
  }

  if (vote) {
    const questions = vote.questions.map((q) => ({ text: q.text }))
    send.message.vote = {
      questions,
      answers: [],
      status: db.VoteStatusEnum.OPEN
    }
  }

  // reply
  await addUnreadQueue(room, saved.insertedId.toHexString())
  const replied = repliedAccounts(message)
  if (replied.length > 0) {
    for (const account of replied) {
      const user = await db.collections.users.findOne({ account })
      if (user) {
        await addRepliedQueue(room, user._id.toHexString())
      }
    }
  }

  const users = await getAllUserIdsInRoom(room)
  addQueueToUsers(users, send)
  return
}

type IineMessage = {
  cmd: typeof ReceiveMessageCmd.MESSAGE_IINE
  id: string
}

export const iine = async (user: string, data: IineMessage) => {
  const target = await db.collections.messages.findOne({
    _id: new ObjectId(data.id)
  })

  await db.collections.messages.updateOne(
    { _id: target._id },
    { $inc: { iine: 1 } }
  )

  const users = await getAllUserIdsInRoom(target.roomId.toHexString())
  const send: SendMessageType = {
    cmd: 'message:iine',
    iine: (target.iine ? target.iine : 0) + 1,
    room: target.roomId.toHexString(),
    id: target._id.toHexString()
  }
  addQueueToUsers(users, send)

  return
}

type ModifyMessage = {
  cmd: typeof ReceiveMessageCmd.MESSAGE_MODIFY
  id: string
  message: string
}

export const modifyMessage = async (user: string, data: ModifyMessage) => {
  const message = escape(trim(data.message))
  const id = escape(trim(data.id))
  // todo: send bad request
  if (isEmpty(message) || isEmpty(id)) {
    return
  }
  const targetId = new ObjectId(id)

  const from = await db.collections.messages.findOne({
    _id: targetId
  })

  // todo: send bad request
  if (from.userId.toHexString() !== user) {
    return
  }

  const updatedAt = new Date()
  await db.collections.messages.updateOne(
    { _id: targetId },
    { $set: { message: message, updated: true, updatedAt } }
  )

  const u = await db.collections.users.findOne({
    _id: new ObjectId(user)
  })
  const send: SendMessageType = {
    user: user,
    cmd: 'message:modify',
    message: {
      id: from._id.toHexString(),
      message: unescape(message),
      iine: from.iine ? from.iine : 0,
      userId: from.userId.toHexString(),
      userAccount: u.account,
      updated: true,
      createdAt: from.createdAt,
      updatedAt: updatedAt,
      icon: createUserIconPath(u.account, u.icon?.version)
    },
    room: from.roomId.toHexString()
  }

  const users = await getAllUserIdsInRoom(from.roomId.toHexString())
  addQueueToUsers(users, send)
}

type GetMessages = {
  cmd: typeof ReceiveMessageCmd.MESSAGES_ROOM
  room: string
  id?: string
}

export const getMessagesFromRoom = async (
  user: string,
  data: GetMessages
): Promise<SendMessageType> => {
  const room = escape(trim(data.room))
  // todo: send bad request
  if (isEmpty(room)) {
    return
  }
  const filter: Pick<db.Enter, 'userId' | 'roomId'> = {
    userId: new ObjectId(user),
    roomId: new ObjectId(room)
  }
  const exist = await db.collections.enter.findOne(filter)
  // todo: send bad request
  if (!exist) {
    return
  }
  let id = null
  if (data.id) {
    id = escape(trim(data.id))
  }
  const { existHistory, messages } = await getMessages(room, id)
  const send: SendMessageType = {
    user: user,
    cmd: 'messages:room',
    room,
    messages: messages,
    existHistory
  }
  return send
}

type EnterRoom = {
  cmd: typeof ReceiveMessageCmd.ROOMS_ENTER
  id?: string
  name?: string
}

export const enterRoom = async (
  user: string,
  data: EnterRoom
): Promise<SendMessageType> => {
  let room: WithId<db.Room> = null
  if (data.id) {
    const id = escape(trim(data.id))
    room = await db.collections.rooms.findOne({ _id: new ObjectId(id) })
  } else if (data.name) {
    const name = popParam(decodeURIComponent(data.name))
    const valid = isValidateRoomName(name)
    if (!valid.valid) {
      return {
        user,
        cmd: 'rooms:enter:fail',
        id: null,
        name: data.name,
        reason: valid.reason
      }
    }
    const found = await db.collections.rooms.findOne({ name: name })

    if (found) {
      room = found
    } else {
      room = await createRoom(new ObjectId(user), name)
    }
  }

  if (!room) {
    return {
      user,
      cmd: 'rooms:enter:fail',
      id: null,
      name: data.name,
      reason: 'not found'
    }
  }

  await logicEnterRoom(new ObjectId(user), room._id)

  return {
    user,
    cmd: 'rooms:enter:success',
    id: room._id.toHexString(),
    name: room.name,
    iconUrl: createRoomIconPath(room)
  }
}

type ReadMessage = {
  cmd: typeof ReceiveMessageCmd.ROOMS_READ
  room?: string
}

export const readMessage = async (user: string, data: ReadMessage) => {
  if (isEmpty(data.room)) {
    // todo BadRequest
    return
  }
  await db.collections.enter.updateOne(
    {
      userId: new ObjectId(user),
      roomId: new ObjectId(data.room)
    },
    { $set: { unreadCounter: 0, replied: 0 } }
  )

  await addMessageQueue({ user, cmd: 'rooms:read', room: data.room })
}

type SortRooms = {
  cmd: typeof ReceiveMessageCmd.ROOMS_SORT
  roomOrder?: string[]
}

export const sortRooms = async (user: string, data: SortRooms) => {
  if (!data.roomOrder || !Array.isArray(data.roomOrder)) {
    // todo BadRequest
    return
  }

  const roomOrder = []
  for (const room of data.roomOrder) {
    if (typeof room !== 'string') {
      // todo BadRequest
      return
    }
    roomOrder.push(room)
  }

  await db.collections.users.updateOne(
    { _id: new ObjectId(user) },
    { $set: { roomOrder } }
  )

  await addMessageQueue({ user, cmd: 'rooms:sort:success', roomOrder })
}

type OpenRoom = { cmd: typeof ReceiveMessageCmd.ROOMS_OPEN; roomId: string }

export const openRoom = async (user: string, data: OpenRoom) => {
  const roomId = new ObjectId(data.roomId)

  const general = await db.collections.rooms.findOne({
    name: config.room.GENERAL_ROOM_NAME
  })

  if (roomId.toHexString() === general?._id.toHexString()) {
    return
  }

  await db.collections.rooms.updateOne(
    { _id: new ObjectId(data.roomId) },
    { $set: { status: db.RoomStatusEnum.OPEN, updatedBy: new ObjectId(user) } }
  )
  addUpdateSearchRoomQueue([data.roomId])
  // @todo 伝播
}

type CloseRoom = { cmd: typeof ReceiveMessageCmd.ROOMS_CLOSE; roomId: string }

export const closeRoom = async (user: string, data: CloseRoom) => {
  const roomId = new ObjectId(data.roomId)

  const general = await db.collections.rooms.findOne({
    name: config.room.GENERAL_ROOM_NAME
  })

  if (roomId.toHexString() === general?._id.toHexString()) {
    return
  }

  await db.collections.rooms.updateOne(
    { _id: new ObjectId(data.roomId) },
    { $set: { status: db.RoomStatusEnum.CLOSE, updatedBy: new ObjectId(user) } }
  )

  addUpdateSearchRoomQueue([data.roomId])
  // @todo 伝播
}

export type SendVoteAnswer = {
  cmd: typeof ReceiveMessageCmd.VOTE_ANSWER_SEND
  messageId: string
  index: number
  answer: number
}

const isAnswer = (answer: number): answer is db.VoteAnswer['answer'] => {
  return Object.values<number>(db.VoteAnswerEnum).includes(answer)
}

export const sendVoteAnswer = async (user: string, data: SendVoteAnswer) => {
  if (
    !Object.prototype.hasOwnProperty.call(data, 'messageId') ||
    !Object.prototype.hasOwnProperty.call(data, 'index') ||
    !Object.prototype.hasOwnProperty.call(data, 'answer')
  ) {
    // todo: send bad request
    return
  }

  if (
    !isNumeric(`${data.index}`, { no_symbols: true }) ||
    !isNumeric(`${data.answer}`, { no_symbols: true })
  ) {
    // todo: send bad request
    return
  }

  if (!isAnswer(data.answer)) {
    // todo: send bad request
    return
  }

  const messageId = new ObjectId(data.messageId)

  const message = await db.collections.messages.findOne({ _id: messageId })
  if (
    !message ||
    !message.vote ||
    message.vote.status !== db.VoteStatusEnum.OPEN ||
    data.answer > message.vote.questions.length
  ) {
    // todo: send bad request
    return
  }

  await db.collections.voteAnswer.updateOne(
    {
      messageId: messageId,
      userId: new ObjectId(user),
      index: data.index
    },
    {
      $set: { answer: data.answer }
    },
    { upsert: true }
  )

  addVoteQueue(data.messageId)
}

type RemoveVoteAnswer = {
  cmd: typeof ReceiveMessageCmd.VOTE_ANSWER_REMOVE
  messageId: string
  index: number
}

export const removeVoteAnswer = async (
  user: string,
  data: RemoveVoteAnswer
) => {
  if (
    !Object.prototype.hasOwnProperty.call(data, 'messageId') ||
    !Object.prototype.hasOwnProperty.call(data, 'index')
  ) {
    // todo: send bad request
    return
  }
  if (!isNumeric(`${data.index}`, { no_symbols: true })) {
    // todo: send bad request
    return
  }

  const messageId = new ObjectId(data.messageId)

  const message = await db.collections.messages.findOne({ _id: messageId })
  if (
    !message ||
    !message.vote ||
    message.vote.status !== db.VoteStatusEnum.OPEN
  ) {
    // todo: send bad request
    return
  }
  // @todo check open

  await db.collections.voteAnswer.deleteOne({
    messageId: messageId,
    userId: new ObjectId(user),
    index: data.index
  })

  addVoteQueue(data.messageId)
}
