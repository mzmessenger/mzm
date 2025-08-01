import { ObjectId } from 'mongodb'
import { type ExRedisClient, lock, release } from '../redis.js'
import { logger } from '../logger.js'
import { RoomQueueType, JobType } from '../../types.js'
import * as config from '../../config.js'

export async function addInitializeSearchRoomQueue(client: ExRedisClient) {
  const lockKey = config.lock.INIT_SEARCH_ROOM_QUEUE
  const lockVal = new ObjectId().toHexString()
  const locked = await lock(client, lockKey, lockVal, 1000 * 2)

  if (!locked) {
    logger.info('[locked] addInitializeSearchRoomQueue')
    return
  }

  await client.xadd(
    config.stream.ELASTICSEARCH_ROOMS,
    'MAXLEN',
    1000,
    '*',
    RoomQueueType.INIT,
    ''
  )

  await release(client, lockKey, lockVal)

  await addSyncSearchRoomQueue(client)
}

export async function addUpdateSearchRoomQueue(
  client: ExRedisClient,
  roomIds: string[]
) {
  await client.xadd(
    config.stream.ELASTICSEARCH_ROOMS,
    'MAXLEN',
    1000,
    '*',
    RoomQueueType.ROOM,
    JSON.stringify(roomIds)
  )

  logger.info('[queue] addUpdateSearchRoomQueue', roomIds.length)
}

export async function addSyncSearchRoomQueue(client: ExRedisClient) {
  const lockKey = config.lock.SYNC_SEARCH_ROOM_QUEUE
  const lockVal = new ObjectId().toHexString()
  const locked = await lock(client, lockKey, lockVal, 1000 * 2)

  if (!locked) {
    logger.info('[locked] addSyncSearchRoomQueue')
    return
  }

  await client.xadd(
    config.stream.JOB,
    'MAXLEN',
    1000,
    '*',
    JobType.SEARCH_ROOM,
    ''
  )

  await release(client, lockKey, lockVal)
  logger.info('[queue] addSyncSearchRoomQueue')
}
