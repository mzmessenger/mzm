import { ObjectId } from 'mongodb'
import { client, lock, release } from '../redis.js'
import { logger } from '../logger.js'
import { RoomQueueType, JobType } from '../../types.js'
import * as config from '../../config.js'

export async function addInitializeSearchRoomQueue() {
  const lockKey = config.lock.INIT_SEARCH_ROOM_QUEUE
  const lockVal = new ObjectId().toHexString()
  const locked = await lock(lockKey, lockVal, 1000 * 2)

  if (!locked) {
    logger.info('[locked] addInitializeSearchRoomQueue')
    return
  }

  await client().xadd(
    config.stream.ELASTICSEARCH_ROOMS,
    'MAXLEN',
    1000,
    '*',
    RoomQueueType.INIT,
    ''
  )

  await release(lockKey, lockVal)

  await addSyncSearchRoomQueue()
}

export async function addUpdateSearchRoomQueue(roomIds: string[]) {
  await client().xadd(
    config.stream.ELASTICSEARCH_ROOMS,
    'MAXLEN',
    1000,
    '*',
    RoomQueueType.ROOM,
    JSON.stringify(roomIds)
  )

  logger.info('[queue] addUpdateSearchRoomQueue', roomIds.length)
}

export async function addSyncSearchRoomQueue() {
  const lockKey = config.lock.SYNC_SEARCH_ROOM_QUEUE
  const lockVal = new ObjectId().toHexString()
  const locked = await lock(lockKey, lockVal, 1000 * 2)

  if (!locked) {
    logger.info('[locked] addSyncSearchRoomQueue')
    return
  }

  await client().xadd(
    config.stream.JOB,
    'MAXLEN',
    1000,
    '*',
    JobType.SEARCH_ROOM,
    ''
  )

  await release(lockKey, lockVal)
  logger.info('[queue] addSyncSearchRoomQueue')
}
