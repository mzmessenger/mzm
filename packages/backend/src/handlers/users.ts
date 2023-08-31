import type { Request } from 'express'
import { apis } from 'mzm-shared/api/universal'
import { z } from 'zod'
import { ObjectId } from 'mongodb'
import { isValidAccount } from 'mzm-shared/validator'
import { createHandlerWithContext } from '../lib/wrap.js'
import {
  getRequestUserId,
  createUserIconPath,
  createContextParser
} from '../lib/utils.js'
import { BadRequest, NotFound } from 'mzm-shared/lib/errors'
import { collections, mongoClient } from '../lib/db.js'

const updateContext = () => {
  const api = apis['/api/user/@me'].PUT
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

export const update = createHandlerWithContext(
  '/api/user/@me',
  'put',
  updateContext()
)(async (req: Request, context) => {
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

export const getUserInfo = createHandlerWithContext('/api/user/@me', 'get', {
  api: apis['/api/user/@me'].GET
})(async (req: Request, context) => {
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
