import type { Express, json } from 'express'
import type { checkAccessToken as checkAccessTokenMiddleware } from '../middleware/index.js'
import { z } from 'zod'
import { ObjectId } from 'mongodb'
import { apis, type API } from 'mzm-shared/src/api/universal'
import { response } from 'mzm-shared/src/lib/wrap'
import { isValidAccount } from 'mzm-shared/src/validator'
import { BadRequest, NotFound } from 'mzm-shared/src/lib/errors'
import {
  getRequestUserId,
  createUserIconPath
} from '../lib/utils.js'
import { collections, mongoClient } from '../lib/db.js'

export function createRoute(
  app: Express,
  {
    jsonParser,
    checkAccessToken
  }: {
    jsonParser: ReturnType<typeof json>
    checkAccessToken: typeof checkAccessTokenMiddleware
  }
) {
  app.put(
    '/api/user/@me',
    checkAccessToken,
    jsonParser,
    async (req, res) => {
      const userId = getRequestUserId(req)
      const data = await update(new ObjectId(userId), req.body)
      return response<API['/api/user/@me']['PUT']['response'][200]['body']>(data)(req, res)
    }
  )

  app.get(
    '/api/user/@me',
    checkAccessToken,
    async (req, res) => {
      const userId = getRequestUserId(req)
      const data = await getUserInfo(new ObjectId(userId))
      return response<API['/api/user/@me']['GET']['response'][200]['body']>(data)(req, res)
    }
  )

  return app
}

export async function update(userId: ObjectId, body: unknown) {
  const api = apis['/api/user/@me']['PUT']
  const bodyParser = z.object({
   account: z.string().min(1).trim()
  })
  const parsed = bodyParser.safeParse(body)
  if (parsed.success === false) {
    throw new BadRequest(api.response[400].body('bad request'))
  }
  const account = parsed.data.account.trim()
  if (!isValidAccount(account)) {
    throw new BadRequest(api.response[400].body('account is not valid'))
  }


  const db = await mongoClient()
  const user = await collections(db).users.findOne({
    account: account
  })
  if (user && user._id.toHexString() !== userId.toHexString()) {
    throw new BadRequest(
      api.response[400].body(`${account} is already exists`)
    )
  }

  await collections(db).users.findOneAndUpdate(
    { _id: userId },
    { $set: { account } },
    { upsert: true }
  )

  return api.response[200].body({ id: userId.toHexString(), account: account })
}

export async function getUserInfo(userId: ObjectId) {
  const api = apis['/api/user/@me']['GET']
  const db = await mongoClient()
  const user = await collections(db).users.findOne(
    { _id: userId },
    { projection: { account: 1, icon: 1 } }
  )

  if (!user || !user.account) {
    throw new NotFound(
      api.response[404].body({
        reason: 'account is not found',
        id: userId.toHexString()
      })
    )
  }

  return api.response[200].body({
    id: user._id.toHexString(),
    account: user.account,
    icon: createUserIconPath(user.account, user.icon?.version)
  })
}
