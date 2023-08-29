import type { Request } from 'express'
import type { API } from 'mzm-shared/type/api'
import { z } from 'zod'
import { ObjectId } from 'mongodb'
import { isValidAccount } from 'mzm-shared/validator'
import { createHandler } from '../lib/wrap.js'
import { getRequestUserId, createUserIconPath, popParam } from '../lib/utils.js'
import { BadRequest, NotFound } from 'mzm-shared/lib/errors'
import { collections, mongoClient, User } from '../lib/db.js'

const UpdateParser = z.object({
  account: z.string().min(1)
})

export const update = createHandler(
  '/api/user/@me',
  'put'
)(async (req: Request) => {
  type ResType = API['/api/user/@me']['PUT']['RESPONSE']
  const parsed = UpdateParser.safeParse(req.body)
  if (parsed.success === false) {
    throw new BadRequest<ResType[400]>('bad request')
  }
  const body = parsed.data
  const account = popParam(body.account)
  if (!account) {
    throw new BadRequest<ResType[400]>('account is empty')
  }
  if (!isValidAccount(account)) {
    throw new BadRequest<ResType[400]>('account is not valid')
  }

  const id = getRequestUserId(req)
  const db = await mongoClient()
  const user = await collections(db).users.findOne({
    account: account
  })
  if (user && user._id.toHexString() !== id) {
    throw new BadRequest<ResType[400]>(`${account} is already exists`)
  }

  const userId = new ObjectId(id)
  await collections(db).users.findOneAndUpdate(
    { _id: userId },
    { $set: { account } },
    { upsert: true }
  )

  const response: ResType[200] = { id: id, account: account }
  return response
})

export const getUserInfo = createHandler(
  '/api/user/@me',
  'get'
)(async (req: Request) => {
  type ResType = API['/api/user/@me']['GET']['RESPONSE']

  const id = getRequestUserId(req)

  const db = await mongoClient()
  const user = await collections(db).users.findOne(
    { _id: new ObjectId(id) },
    { projection: { account: 1, icon: 1 } }
  )

  if (!user || !user.account) {
    throw new NotFound<ResType[404]>({
      reason: 'account is not found',
      id
    })
  }

  const response: ResType[200] = {
    id: user._id.toHexString(),
    account: user.account,
    icon: createUserIconPath(user.account, user.icon?.version)
  }

  return response
})

export const updateAccount = createHandler(
  '/api/user/@me/account',
  'post'
)(async (req: Request) => {
  const id = getRequestUserId(req)
  const account = popParam(req.body.account)
  if (!account) {
    throw new BadRequest('account is empty')
  }
  if (!isValidAccount(account)) {
    throw new BadRequest('account is not valid')
  }

  const update: Pick<User, 'account'> = { account }
  const db = await mongoClient()
  const updated = await collections(db).users.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    {
      upsert: true
    }
  )

  return {
    update: updated.value?._id.toHexString()
  }
})
