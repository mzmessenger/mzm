import { ObjectId, WithId } from 'mongodb'
import { VoteStatusEnum, VoteTypeEnum } from 'mzm-shared/type/db'
import {
  TO_SERVER_CMD,
  FilterSocketToBackendType,
  TO_CLIENT_CMD,
  ToClientType
} from 'mzm-shared/type/socket'
import validator from 'validator'
import { logger } from '../../lib/logger.js'
import * as db from '../../lib/db.js'
import * as config from '../../config.js'
import {
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
  getRooms as getRoomsLogic,
  initUser
} from '../../logic/users.js'
import {
  isValidateRoomName,
  createRoom,
  enterRoom as logicEnterRoom
} from '../../logic/rooms.js'

export const connection = async (
  userId: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.CONNECTION>
): Promise<ToClientType> => {
  const id = new ObjectId(userId)
  const user = await db.collections.users.findOne({
    _id: id
  })

  let signup = false

  if (!user || !user.account || user.account === '') {
    const account = data.payload.twitterUserName || data.payload.githubUserName
    await initUser(id, account)
    signup = true
  }

  return {
    cmd: TO_CLIENT_CMD.SOCKET_CONNECTION,
    user: userId,
    signup
  }
}

export const getRooms = async (userId: string): Promise<ToClientType> => {
  const [user, rooms] = await Promise.all([
    db.collections.users.findOne<Pick<db.User, 'roomOrder'>>(
      { _id: new ObjectId(userId) },
      { projection: { roomOrder: 1 } }
    ),
    getRoomsLogic(userId)
  ])
  const room: ToClientType = {
    user: userId,
    cmd: TO_CLIENT_CMD.ROOMS_GET,
    rooms,
    roomOrder: user.roomOrder ? user.roomOrder : []
  }
  return room
}

export const sendMessage = async (
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.MESSAGE_SEND>
) => {
  const message = validator.escape(validator.trim(data.message))
  const room = validator.escape(validator.trim(data.room))
  // todo: send bad request
  if (validator.isEmpty(message) || validator.isEmpty(room)) {
    return
  }

  // アンケート
  let vote: db.Message['vote'] = null
  if (data.vote) {
    let length = 0
    const questions = []
    for (const q of data.vote.questions) {
      if (
        validator.isEmpty(q.text) ||
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
      status: VoteStatusEnum.OPEN,
      type: VoteTypeEnum.CHOICE
    }
  }

  const saved = await saveMessage(message, room, user, vote)

  if (!saved) {
    return
  }

  const u = await db.collections.users.findOne({
    _id: new ObjectId(user)
  })
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

export const iine = async (
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.MESSAGE_IINE>
) => {
  const target = await db.collections.messages.findOne({
    _id: new ObjectId(data.id)
  })

  await db.collections.messages.updateOne(
    { _id: target._id },
    { $inc: { iine: 1 } }
  )

  const users = await getAllUserIdsInRoom(target.roomId.toHexString())
  const send: ToClientType = {
    cmd: TO_CLIENT_CMD.MESSAGE_IINE,
    iine: (target.iine ? target.iine : 0) + 1,
    room: target.roomId.toHexString(),
    id: target._id.toHexString()
  }
  addQueueToUsers(users, send)

  return
}

export const modifyMessage = async (
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.MESSAGE_MODIFY>
) => {
  const message = validator.escape(validator.trim(data.message))
  const id = validator.escape(validator.trim(data.id))
  // todo: send bad request
  if (validator.isEmpty(message) || validator.isEmpty(id)) {
    return
  }
  const targetId = new ObjectId(id)

  const from = await db.collections.messages.findOne({
    _id: targetId
  })

  // todo: send bad request
  if (from.userId.toHexString() !== user || from.removed === true) {
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

  const users = await getAllUserIdsInRoom(from.roomId.toHexString())
  addQueueToUsers(users, send)
}

export const removeMessage = async (
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.MESSAGE_REMOVE>
) => {
  const id = escape(validator.trim(data.id))
  // todo: send bad request
  if (validator.isEmpty(id)) {
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
    { $set: { removed: true, updatedAt } }
  )

  const u = await db.collections.users.findOne({
    _id: new ObjectId(user)
  })
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

  const users = await getAllUserIdsInRoom(from.roomId.toHexString())
  addQueueToUsers(users, send)
}

export const getMessagesFromRoom = async (
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.MESSAGES_ROOM>
): Promise<ToClientType> => {
  const room = escape(validator.trim(data.room))
  // todo: send bad request
  if (validator.isEmpty(room)) {
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
    id = escape(validator.trim(data.id))
  }
  const { existHistory, messages } = await getMessages(room, id)
  const send: ToClientType = {
    user: user,
    cmd: TO_CLIENT_CMD.MESSAGES_ROOM,
    room,
    messages: messages,
    existHistory
  }
  return send
}

export const enterRoom = async (
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.ROOMS_ENTER>
): Promise<ToClientType> => {
  let room: WithId<db.Room> = null
  if (data.id) {
    const id = escape(validator.trim(data.id))
    room = await db.collections.rooms.findOne({ _id: new ObjectId(id) })
  } else if (data.name) {
    const name = popParam(decodeURIComponent(data.name))
    const valid = isValidateRoomName(name)
    if (!valid.valid) {
      return {
        user,
        cmd: TO_CLIENT_CMD.ROOMS_ENTER_FAIL,
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
      cmd: TO_CLIENT_CMD.ROOMS_ENTER_FAIL,
      id: null,
      name: data.name,
      reason: 'not found'
    }
  }

  await logicEnterRoom(new ObjectId(user), room._id)

  return {
    user,
    cmd: TO_CLIENT_CMD.ROOMS_ENTER_SUCCESS,
    id: room._id.toHexString(),
    name: room.name,
    description: room.description ?? '',
    iconUrl: createRoomIconPath(room)
  }
}

export const readMessage = async (
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.ROOMS_READ>
) => {
  if (validator.isEmpty(data.room)) {
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

  await addMessageQueue({
    user,
    cmd: TO_CLIENT_CMD.ROOMS_READ,
    room: data.room
  })
}

export const sortRooms = async (
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.ROOMS_SORT>
) => {
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

  await addMessageQueue({
    user,
    cmd: TO_CLIENT_CMD.ROOMS_SORT_SUCCESS,
    roomOrder
  })
}

export const openRoom = async (
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.ROOMS_OPEN>
) => {
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

export const closeRoom = async (
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.ROOMS_CLOSE>
) => {
  if (!data.roomId) {
    return
  }
  const roomId = new ObjectId(data.roomId)

  const general = await db.collections.rooms.findOne({
    name: config.room.GENERAL_ROOM_NAME
  })

  if (roomId.toHexString() === general?._id.toHexString()) {
    return
  }

  await db.collections.rooms.updateOne(
    { _id: roomId },
    { $set: { status: db.RoomStatusEnum.CLOSE, updatedBy: new ObjectId(user) } }
  )

  addUpdateSearchRoomQueue([data.roomId])
  // @todo 伝播
}

export const updateRoomDescription = async (
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.ROOMS_UPDATE_DESCRIPTION>
) => {
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

  await db.collections.rooms.updateOne(
    { _id: roomId },
    { $set: { description: data.description, updatedBy: new ObjectId(user) } }
  )

  const users = await getAllUserIdsInRoom(roomId.toHexString())
  const send: ToClientType = {
    cmd: TO_CLIENT_CMD.ROOMS_UPDATE_DESCRIPTION,
    roomId: data.roomId,
    descrioption: data.description
  }
  addQueueToUsers(users, send)

  addUpdateSearchRoomQueue([data.roomId])
}

const isAnswer = (answer: number): answer is db.VoteAnswer['answer'] => {
  return Object.values<number>(db.VoteAnswerEnum).includes(answer)
}

export const sendVoteAnswer = async (
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.VOTE_ANSWER_SEND>
) => {
  if (
    !Object.prototype.hasOwnProperty.call(data, 'messageId') ||
    !Object.prototype.hasOwnProperty.call(data, 'index') ||
    !Object.prototype.hasOwnProperty.call(data, 'answer')
  ) {
    // todo: send bad request
    return
  }

  if (
    !validator.isNumeric(`${data.index}`, { no_symbols: true }) ||
    !validator.isNumeric(`${data.answer}`, { no_symbols: true })
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
    message.vote.status !== VoteStatusEnum.OPEN ||
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

export const removeVoteAnswer = async (
  user: string,
  data: FilterSocketToBackendType<typeof TO_SERVER_CMD.VOTE_ANSWER_REMOVE>
) => {
  if (
    !Object.prototype.hasOwnProperty.call(data, 'messageId') ||
    !Object.prototype.hasOwnProperty.call(data, 'index')
  ) {
    // todo: send bad request
    return
  }
  if (!validator.isNumeric(`${data.index}`, { no_symbols: true })) {
    // todo: send bad request
    return
  }

  const messageId = new ObjectId(data.messageId)

  const message = await db.collections.messages.findOne({ _id: messageId })
  if (
    !message ||
    !message.vote ||
    message.vote.status !== VoteStatusEnum.OPEN
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
