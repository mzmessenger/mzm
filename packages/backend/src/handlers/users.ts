import { apis } from 'mzm-shared/src/api/universal'
import { z } from 'zod'
import { ObjectId } from 'mongodb'
import { isValidAccount } from 'mzm-shared/src/validator'
import { createHandler } from '../lib/wrap.js'
import {
  getRequestUserId,
  createUserIconPath,
  createContextParser
} from '../lib/utils.js'
import { BadRequest, NotFound } from 'mzm-shared/src/lib/errors'
import { collections, mongoClient } from '../lib/db.js'

export const update = createHandler(
  '/api/user/@me',
  'PUT',
  ({ path, method }) => {
    const api = apis[path][method]
    const body = createContextParser(
      z.object({
        account: z.string().min(1).trim()
      }),
      (parsed) => {
        return {
          success: true,
          data: api.request.body({
            account: parsed.data.account
          })
        }
      }
    )

    return {
      api,
      parser: { body }
    }
  }
)(async (req, context) => {
  const parsed = context.parser.body(req.body)
  if (parsed.success === false) {
    throw new BadRequest(context.api.response[400].body('bad request'))
  }
  const account = parsed.data.account.trim()
  if (!isValidAccount(account)) {
    throw new BadRequest(context.api.response[400].body('account is not valid'))
  }

  const id = getRequestUserId(req)
  const db = await mongoClient()
  const user = await collections(db).users.findOne({
    account: account
  })
  if (user && user._id.toHexString() !== id) {
    throw new BadRequest(
      context.api.response[400].body(`${account} is already exists`)
    )
  }

  const userId = new ObjectId(id)
  await collections(db).users.findOneAndUpdate(
    { _id: userId },
    { $set: { account } },
    { upsert: true }
  )

  return context.api.response[200].body({ id: id, account: account })
})

export const getUserInfo = createHandler(
  '/api/user/@me',
  'GET',
  ({ path, method }) => {
    return {
      api: apis[path][method]
    }
  }
)(async (req, context) => {
  const id = getRequestUserId(req)

  const db = await mongoClient()
  const user = await collections(db).users.findOne(
    { _id: new ObjectId(id) },
    { projection: { account: 1, icon: 1 } }
  )

  if (!user || !user.account) {
    throw new NotFound(
      context.api.response[404].body({
        reason: 'account is not found',
        id
      })
    )
  }

  return context.api.response[200].body({
    id: user._id.toHexString(),
    account: user.account,
    icon: createUserIconPath(user.account, user.icon?.version)
  })
})
