/**
 * Document types whose fields are typed with mongodb's `ObjectId`.
 *
 * They live apart from `./db.js` so that the browser and Worker builds, which
 * reach `./db.js` transitively through `../api/universal.js`, never pull the
 * mongodb types into their module graph.
 */
import type { ObjectId } from 'mongodb'
import type { RoomStatusEnum } from './db.js'

export type Room = {
  name: string
  description?: string
  createdBy: string
  updatedBy?: ObjectId
  icon?: {
    key: string
    version: string
  }
  status: (typeof RoomStatusEnum)[keyof typeof RoomStatusEnum]
}

export type Enter = {
  roomId: ObjectId
  userId: ObjectId
  unreadCounter: number
  replied: number
  processedEventIds?: string[]
}
