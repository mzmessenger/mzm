import { ObjectId, WithId, type MongoClient } from 'mongodb'
import { VoteStatusEnum, VoteTypeEnum } from 'mzm-shared/src/type/db'
import {
  TO_SERVER_CMD,
  FilterSocketToBackendType,
  TO_CLIENT_CMD,
  ToClientType
} from 'mzm-shared/src/type/socket'
import { z } from 'zod'
import { logger } from '../../lib/logger.js'
import {
  collections,
  RoomStatusEnum,
  VoteAnswerEnum,
  type Message,
  type Enter,
  type Room,
  type User,
  type VoteAnswer
} from '../../lib/db.js'
import * as config from '../../config.js'
import {
  escape,
  unescape,
  popParam,
  createUserIconPath,
  createRoomIconPath,
  repliedAccounts
} from '../../lib/utils.js'
import {
  addMessageQueue,
  addQueueToUsers,
  addUnreadQueue,
  addRepliedQueue,
  addUpdateSearchRoomQueue,
  addVoteQueue
} from '../../lib/provider/index.js'
import { saveMessage, getMessages } from '../../logic/messages.js'
import {
  getAllUserIdsInRoom,
  getRooms as getRoomsLogic
} from '../../logic/users.js'
import {
  isValidateRoomName,
  createRoom,
  enterRoom as logicEnterRoom
} from '../../logic/rooms.js'

export async function getRooms(
  db: MongoClient,
  userId: string
): Promise<ToClientType | void> {
  const [user, rooms] = await Promise.all([
    collections(db).users.findOne<Pick<User, 'roomOrder'>>(
      { _id: new ObjectId(userId) },
      { projection: { roomOrder: 1 } }
    ),
    getRoomsLogic(db, userId)
  ])
  if (!user) {
    return
  }
  const room: ToClientType = {
    user: userId,
    cmd: TO_CLIENT_CMD.ROOMS_GET,
    rooms,
    roomOrder: user.roomOrder ? user.roomOrder : []
  }
  return room
}

const sendMessageParser = z.object({
  message: z.string().min(1),
  room: z.string().min(1),
  vote: z
    .object({
      questions: z.array(
        z.object({
          text: z.string().min(1)
        })
      )
    })
    .optional()
})
export async function sendMessage(
  db: MongoClient,
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.MESSAGE_SEND>
) {
  const parsed = sendMessageParser.safeParse(data)
  if (parsed.success === false) {
    return
  }
  const message = escape(parsed.data.message.trim())
  const room = escape(parsed.data.room.trim())
  // todo: send bad request
  if (!message || !room) {
    return
  }

  // アンケート
  let vote: Message['vote'] | undefined = undefined
  if (parsed.data.vote) {
    const v = parsed.data.vote
    if (v.questions.length > config.vote.MAX_QUESTION_NUM) {
      // todo: send bad request
      return
    }
    const questions: { text: string }[] = []
    for (const q of v.questions) {
      if (!q.text || q.text.length > config.vote.MAX_QUESTION_LENGTH) {
        // todo: send bad request
        return
      }
      questions.push({ text: q.text })
    }
    vote = {
      questions,
      status: VoteStatusEnum.OPEN,
      type: VoteTypeEnum.CHOICE
    }
  }

  const saved = await saveMessage(db, message, room, user, vote)

  if (!saved) {
    return
  }

  const u = await collections(db).users.findOne({
    _id: new ObjectId(user)
  })
  if (!u) {
    return
  }
  const send: ToClientType = {
    user: null,
    cmd: TO_CLIENT_CMD.MESSAGE_RECEIVE,
    message: {
      id: saved.insertedId.toHexString(),
      userId: user,
      userAccount: u.account,
      message: unescape(message),
      iine: 0,
      updated: false,
      removed: false,
      createdAt: Date.now().toString(),
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
      status: VoteStatusEnum.OPEN
    }
  }

  // reply
  await addUnreadQueue(room, saved.insertedId.toHexString())
  const replied = repliedAccounts(message)
  // @todo
  if (replied.length > 0) {
    for (const account of replied) {
      const user = await collections(db).users.findOne({ account })
      if (user) {
        await addRepliedQueue(room, user._id.toHexString())
      }
    }
  }

  const users = await getAllUserIdsInRoom(db, room)
  addQueueToUsers(users, send)

  return send
}

export async function iine(
  db: MongoClient,
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.MESSAGE_IINE>
) {
  const target = await collections(db).messages.findOne({
    _id: new ObjectId(data.id)
  })
  if (!target) {
    return
  }

  await collections(db).messages.updateOne(
    { _id: target._id },
    { $inc: { iine: 1 } }
  )

  const users = await getAllUserIdsInRoom(db, target.roomId.toHexString())
  const send: ToClientType = {
    cmd: TO_CLIENT_CMD.MESSAGE_IINE,
    iine: (target.iine ? target.iine : 0) + 1,
    room: target.roomId.toHexString(),
    id: target._id.toHexString()
  }
  addQueueToUsers(users, send)

  return send
}

const ModifyMessageParser = z.object({
  id: z.string().min(1),
  message: z.string().min(1)
})

export async function modifyMessage(
  db: MongoClient,
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.MESSAGE_MODIFY>
) {
  const parsed = ModifyMessageParser.safeParse(data)
  // todo: send bad request
  if (parsed.success === false) {
    return
  }
  const message = escape(parsed.data.message.trim())
  const id = escape(parsed.data.id.trim())
  // todo: send bad request
  if (!message || !id) {
    return
  }
  const targetId = new ObjectId(id)

  const from = await collections(db).messages.findOne({
    _id: targetId
  })

  // todo: send bad request
  if (from?.userId.toHexString() !== user || from.removed === true) {
    return
  }

  const updatedAt = new Date()
  await collections(db).messages.updateOne(
    { _id: targetId },
    { $set: { message: message, updated: true, updatedAt } }
  )

  const u = await collections(db).users.findOne({
    _id: new ObjectId(user)
  })
  if (!u) {
    return
  }
  const send: ToClientType = {
    user: user,
    cmd: TO_CLIENT_CMD.MESSAGE_MODIFY,
    message: {
      id: from._id.toHexString(),
      message: unescape(message),
      iine: from.iine ? from.iine : 0,
      userId: from.userId.toHexString(),
      userAccount: u.account,
      removed: false,
      updated: true,
      createdAt: from.createdAt.getTime().toString(),
      updatedAt: updatedAt.getTime().toString(),
      icon: createUserIconPath(u.account, u.icon?.version)
    },
    room: from.roomId.toHexString()
  }

  const users = await getAllUserIdsInRoom(db, from.roomId.toHexString())
  addQueueToUsers(users, send)

  return send
}

export async function removeMessage(
  db: MongoClient,
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.MESSAGE_REMOVE>
) {
  const id = escape(data.id.trim())
  // todo: send bad request
  if (!id) {
    return
  }
  const targetId = new ObjectId(id)

  const from = await collections(db).messages.findOne({
    _id: targetId
  })

  // todo: send bad request
  if (from?.userId.toHexString() !== user) {
    return
  }

  const updatedAt = new Date()
  await collections(db).messages.updateOne(
    { _id: targetId },
    { $set: { removed: true, updatedAt } }
  )

  const u = await collections(db).users.findOne({
    _id: new ObjectId(user)
  })
  if (!u) {
    return
  }
  const send: ToClientType = {
    user: user,
    cmd: TO_CLIENT_CMD.MESSAGE_REMOVE,
    message: {
      id: from._id.toHexString(),
      message: '',
      iine: from.iine ? from.iine : 0,
      userId: from.userId.toHexString(),
      userAccount: u.account,
      updated: from.updated,
      removed: true,
      createdAt: from.createdAt.getTime().toString(),
      updatedAt: updatedAt.getTime().toString(),
      icon: createUserIconPath(u.account, u.icon?.version)
    },
    room: from.roomId.toHexString()
  }

  const users = await getAllUserIdsInRoom(db, from.roomId.toHexString())
  addQueueToUsers(users, send)

  return send
}

const GetMessagesFromRoomParser = z.object({
  id: z.string().optional(),
  room: z.string().min(1)
})

export async function getMessagesFromRoom(
  db: MongoClient,
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.MESSAGES_ROOM>
): Promise<ToClientType | void> {
  const parsed = GetMessagesFromRoomParser.safeParse(data)
  if (parsed.success === false) {
    return
  }
  const room = escape(parsed.data.room)
  // todo: send bad request
  if (!room) {
    return
  }
  const filter: Pick<Enter, 'userId' | 'roomId'> = {
    userId: new ObjectId(user),
    roomId: new ObjectId(room)
  }
  const exist = await collections(db).enter.findOne(filter)
  // todo: send bad request
  if (!exist) {
    return
  }
  let id: string | undefined = undefined
  if (data.id) {
    id = escape(data.id.trim())
  }
  const { existHistory, messages } = await getMessages(db, room, id)
  const send: ToClientType = {
    user: user,
    cmd: TO_CLIENT_CMD.MESSAGES_ROOM,
    room,
    messages: messages,
    existHistory
  }
  return send
}

export async function enterRoom(
  db: MongoClient,
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.ROOMS_ENTER>
): Promise<ToClientType> {
  let room: WithId<Room> | null = null
  if (data.id) {
    const id = escape(data.id.trim())
    room = await collections(db).rooms.findOne({ _id: new ObjectId(id) })
  } else if (data.name) {
    const name = popParam(decodeURIComponent(data.name))
    const valid = isValidateRoomName(name)
    if (!valid.valid) {
      return {
        user,
        cmd: TO_CLIENT_CMD.ROOMS_ENTER_FAIL,
        id: null,
        name: data.name,
        reason: valid.reason ?? null
      }
    }
    const found = await collections(db).rooms.findOne({ name: name })

    if (found) {
      room = found
    } else {
      room = await createRoom(db, new ObjectId(user), name)
    }
  }

  if (!room) {
    return {
      user,
      cmd: TO_CLIENT_CMD.ROOMS_ENTER_FAIL,
      id: data.id ?? null,
      name: data.name ?? null,
      reason: 'not found'
    }
  }

  await logicEnterRoom(db, new ObjectId(user), room._id)

  return {
    user,
    cmd: TO_CLIENT_CMD.ROOMS_ENTER_SUCCESS,
    id: room._id.toHexString(),
    name: room.name,
    description: room.description ?? '',
    iconUrl: createRoomIconPath(room)
  }
}

export async function readMessage(
  db: MongoClient,
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.ROOMS_READ>
) {
  if (!data.room) {
    // todo BadRequest
    return
  }
  await collections(db).enter.updateOne(
    {
      userId: new ObjectId(user),
      roomId: new ObjectId(data.room)
    },
    { $set: { unreadCounter: 0, replied: 0 } }
  )

  const send = {
    user,
    cmd: TO_CLIENT_CMD.ROOMS_READ,
    room: data.room
  }
  await addMessageQueue(send)

  return send
}

export async function sortRooms (
  db: MongoClient,
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.ROOMS_SORT>
) {
  if (!data.roomOrder || !Array.isArray(data.roomOrder)) {
    // todo BadRequest
    return
  }

  const roomOrder: string[] = []
  for (const room of data.roomOrder) {
    if (typeof room !== 'string') {
      // todo BadRequest
      return
    }
    roomOrder.push(room)
  }

  await collections(db).users.updateOne(
    { _id: new ObjectId(user) },
    { $set: { roomOrder } }
  )

  const send = {
    user,
    cmd: TO_CLIENT_CMD.ROOMS_SORT_SUCCESS,
    roomOrder
  }
  await addMessageQueue(send)
  return send
}

export async function openRoom(
  db: MongoClient,
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.ROOMS_OPEN>
) {
  const roomId = new ObjectId(data.roomId)

  const general = await collections(db).rooms.findOne({
    name: config.room.GENERAL_ROOM_NAME
  })

  if (roomId.toHexString() === general?._id.toHexString()) {
    return
  }

  await collections(db).rooms.updateOne(
    { _id: new ObjectId(data.roomId) },
    { $set: { status: RoomStatusEnum.OPEN, updatedBy: new ObjectId(user) } }
  )
  addUpdateSearchRoomQueue([data.roomId])
  // @todo 伝播
}

export async function closeRoom(
  db: MongoClient,
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.ROOMS_CLOSE>
) {
  if (!data.roomId) {
    return
  }
  const roomId = new ObjectId(data.roomId)

  const general = await collections(db).rooms.findOne({
    name: config.room.GENERAL_ROOM_NAME
  })

  if (roomId.toHexString() === general?._id.toHexString()) {
    return
  }

  await collections(db).rooms.updateOne(
    { _id: roomId },
    { $set: { status: RoomStatusEnum.CLOSE, updatedBy: new ObjectId(user) } }
  )

  addUpdateSearchRoomQueue([data.roomId])
  // @todo 伝播
}

export async function updateRoomDescription(
  db: MongoClient,
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.ROOMS_UPDATE_DESCRIPTION>
) {
  logger.info('updateRoomDescription', data.roomId, data.description)
  const roomId = new ObjectId(data.roomId)

  if (
    !data.roomId ||
    !data.description ||
    data.description.length > config.room.MAX_ROOM_DESCRIPTION_LENGTH
  ) {
    logger.info('updateRoomDescription:invalid', data.roomId, data.description)
    return
  }

  await collections(db).rooms.updateOne(
    { _id: roomId },
    { $set: { description: data.description, updatedBy: new ObjectId(user) } }
  )

  const users = await getAllUserIdsInRoom(db, roomId.toHexString())
  const send: ToClientType = {
    cmd: TO_CLIENT_CMD.ROOMS_UPDATE_DESCRIPTION,
    roomId: data.roomId,
    descrioption: data.description
  }
  addQueueToUsers(users, send)

  addUpdateSearchRoomQueue([data.roomId])
}

const isAnswer = (answer: number): answer is VoteAnswer['answer'] => {
  return Object.values<number>(VoteAnswerEnum).includes(answer)
}

const SendVoteAnswerParser = z.object({
  index: z.number().min(0),
  messageId: z.string().min(1),
  answer: z.number().min(0)
})

export async function sendVoteAnswer(
  db: MongoClient,
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.VOTE_ANSWER_SEND>
) {
  const parsed = SendVoteAnswerParser.safeParse(data)
  if (parsed.success === false) {
    // todo: send bad request
    return
  }

  if (!isAnswer(parsed.data.answer)) {
    // todo: send bad request
    return
  }

  const messageId = new ObjectId(parsed.data.messageId)

  const message = await collections(db).messages.findOne({ _id: messageId })
  if (
    !message ||
    !message.vote ||
    message.vote.status !== VoteStatusEnum.OPEN ||
    data.answer > message.vote.questions.length
  ) {
    // todo: send bad request
    return
  }

  await collections(db).voteAnswer.updateOne(
    {
      messageId: messageId,
      userId: new ObjectId(user),
      index: parsed.data.index
    },
    {
      $set: { answer: parsed.data.answer }
    },
    { upsert: true }
  )

  addVoteQueue(parsed.data.messageId)
}

const RemoveVoteAnswerParser = z.object({
  messageId: z.string().min(1),
  index: z.number().min(0)
})
export async function removeVoteAnswer(
  db: MongoClient,
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.VOTE_ANSWER_REMOVE>
) {
  const parsed = RemoveVoteAnswerParser.safeParse(data)
  if (parsed.success === false) {
    // todo: send bad request
    return
  }

  const messageId = new ObjectId(parsed.data.messageId)

  const message = await collections(db).messages.findOne({ _id: messageId })
  if (
    !message ||
    !message.vote ||
    message.vote.status !== VoteStatusEnum.OPEN
  ) {
    // todo: send bad request
    return
  }
  // @todo check open

  await collections(db).voteAnswer.deleteOne({
    messageId: messageId,
    userId: new ObjectId(user),
    index: parsed.data.index
  })

  addVoteQueue(data.messageId)
}
