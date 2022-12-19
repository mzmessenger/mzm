import { Request } from 'express'
import { ObjectId } from 'mongodb'
import isEmpty from 'validator/lib/isEmpty.js'
import type { RESPONSE, REQUEST } from 'mzm-shared/type/api'
import { isValidAccount } from 'mzm-shared/validator'
import { getRequestUserId, createUserIconPath, popParam } from '../lib/utils.js'
import { NotFound, BadRequest } from '../lib/errors.js'
import * as db from '../lib/db.js'

export const update = async (req: Request) => {
  type ResponseType = RESPONSE['/api/user/@me']['PUT']['body']

  const body = req.body as Partial<REQUEST['/api/user/@me']['PUT']['body']>
  const account = popParam(body?.account)
  if (!account) {
    throw new BadRequest<ResponseType[400]>('account is empty')
  }
  if (!isValidAccount(account)) {
    throw new BadRequest<ResponseType[400]>('account is not valid')
  }

  const id = getRequestUserId(req)
  const user = await db.collections.users.findOne({
    account: account
  })
  if (user && user._id.toHexString() !== id) {
    throw new BadRequest<ResponseType[400]>(`${account} is already exists`)
  }

  const userId = new ObjectId(id)
  await db.collections.users.findOneAndUpdate(
    { _id: userId },
    { $set: { account } },
    { upsert: true }
  )

  const response: ResponseType[200] = { id: id, account: account }
  return response
}

export const getUserInfo = async (req: Request) => {
  type ResponseType = RESPONSE['/api/user/@me']['GET']['body']

  const id = getRequestUserId(req)

  const user = await db.collections.users.findOne(
    { _id: new ObjectId(id) },
    { projection: { account: 1, icon: 1 } }
  )

  if (!user || !user.account) {
    throw new NotFound<ResponseType[404]>({
      reason: 'account is not found',
      id
    })
  }

  const response: ResponseType[200] = {
    id: user._id.toHexString(),
    account: user.account,
    icon: createUserIconPath(user.account, user.icon?.version)
  }

  return response
}

export const updateAccount = async (req: Request) => {
  const id = getRequestUserId(req)
  const account = popParam(req.body.account)
  if (!account) {
    throw new BadRequest('account is empty')
  }
  if (!isValidAccount(account)) {
    throw new BadRequest('account is not valid')
  }

  const update: Pick<db.User, 'account'> = { account }
  const updated = await db.collections.users.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    {
      upsert: true
    }
  )

  return updated.value
}

export const sortRooms = async (req: Request) => {
  const id = getRequestUserId(req)
  const rooms = popParam(req.body.rooms)
  if (isEmpty(rooms)) {
    throw new BadRequest({ reason: 'rooms is empty' })
  } else if (!Array.isArray(rooms)) {
    throw new BadRequest({ reason: 'rooms is not array' })
  }
  const roomOrder = []
  for (const room of rooms) {
    if (typeof room !== 'string') {
      throw new BadRequest({ reason: `${room} is not string` })
    }
    roomOrder.push(room)
  }

  db.collections.users.updateOne(
    { _id: new ObjectId(id) },
    { $set: { roomOrder } }
  )
}
