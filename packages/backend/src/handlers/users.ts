import { Request } from 'express'
import isEmpty from 'validator/lib/isEmpty'
import type { RESPONSE, REQUEST } from 'mzm-shared/type/api'
import { HEADERS } from 'mzm-shared/auth'
import { getRequestUserId } from '../lib/utils'
import { NotFound, BadRequest } from '../lib/errors'
import { popParam } from '../lib/utils'
import { isValidAccount, initUser } from '../logic/users'
import * as db from '../lib/db'
import { createUserIconPath } from '../lib/utils'
import { ObjectId } from 'mongodb'

export const signUp = async (req: Request) => {
  const body = req.body as Partial<REQUEST['/api/user/signup']['POST']['BODY']>
  const account = popParam(body.account)
  if (!account) {
    throw new BadRequest('account is empty')
  }
  if (!isValidAccount(account)) {
    throw new BadRequest('account is not valid')
  }

  const user = await db.collections.users.findOne({
    account: { $regex: account, $options: 'i' }
  })
  if (user) {
    throw new BadRequest('account is already created')
  }

  const id = getRequestUserId(req)
  const userId = new ObjectId(id)
  await initUser(userId, account)

  return { id: id, account: account }
}

export const getUserInfo = async (
  req: Request
): Promise<RESPONSE['/api/user/@me']['GET']> => {
  const id = getRequestUserId(req)

  const user = await db.collections.users.findOne(
    { _id: new ObjectId(id) },
    { projection: { account: 1, icon: 1 } }
  )

  const twitter: string =
    (req.headers[HEADERS.TIWTTER_USER_NAME] as string) || null
  const github: string =
    (req.headers[HEADERS.GITHUB_USER_NAME] as string) || null

  if (!user || !user.account) {
    throw new NotFound({
      reason: 'account is not found',
      id,
      twitter,
      github
    })
  }

  return {
    id: user._id.toHexString(),
    account: user.account,
    icon: createUserIconPath(user.account, user.icon?.version),
    twitterUserName: twitter,
    githubUserName: github
  }
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
