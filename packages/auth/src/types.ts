import type { Request } from 'express'
import type { WithId } from 'mongodb'
import type { User } from './lib/db.js'

export type SerializeUser = WithId<User> & Request['user']
export type RequestUser = WithId<User> | null
export type PassportRequest = Request & { user?: RequestUser }

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { status: number; message: string } }
