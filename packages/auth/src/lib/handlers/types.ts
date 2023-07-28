import type { Request } from 'express'
import type { WithId } from 'mongodb'
import type { User } from '../db.js'

export type SerializeUser = WithId<User> &
  Request['user'] & {
    accessToken: string
    refreshToken: string
  }
export type SerializedUser = string
export type RequestUser = WithId<User>
export type PassportRequest = Request & { user?: RequestUser }
