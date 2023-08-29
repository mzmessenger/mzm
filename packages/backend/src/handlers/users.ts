import type { Request } from 'express'
import type { API } from 'mzm-shared/type/api'
import type { Result } from 'mzm-shared/type'
import { z } from 'zod'
import { ObjectId } from 'mongodb'
import { isValidAccount } from 'mzm-shared/validator'
import { createHandler, createHandlerWithContext } from '../lib/wrap.js'
import {
  getRequestUserId,
  createUserIconPath,
  createContextParser
} from '../lib/utils.js'
import { BadRequest, NotFound } from 'mzm-shared/lib/errors'
import { collections, mongoClient } from '../lib/db.js'

const updateContext = () => {
  const body = createContextParser(
    z.object({
      account: z.string().min(1).trim()
    }),
    (parsed): Result<API['/api/user/@me']['PUT']['REQUEST']['body']> => {
      return {
        success: true,
        data: {
          account: parsed.data.account
        }
      }
    }
  )

  return {
    parser: { body }
  }
}

export const update = createHandlerWithContext(
  '/api/user/@me',
  'put',
  updateContext()
)(async (req: Request, context) => {
  type ResType = API['/api/user/@me']['PUT']['RESPONSE']
  const parsed = context.parser.body(req.body)
  if (parsed.success === false) {
    throw new BadRequest<ResType[400]>('bad request')
  }
  const account = parsed.data.account.trim()
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
