import { MongoClient } from 'mongodb'
import * as config from '../../../config.js'
import { logger } from '../../logger.js'
import { type ExRedisClient } from '../../redis.js'
import {
  initAlias,
  insertRooms as _insertRooms
} from '../../elasticsearch/rooms.js'
import { initConsumerGroup, createParser, consumeGroup } from '../common.js'
import { RoomQueueType } from '../../../types.js'

const STREAM = config.stream.ELASTICSEARCH_ROOMS
const ELASTICSEARCH_ROOMS_GROUP = 'group:elasticsearch:rooms'

export async function initSearchRoomConsumerGroup(client: ExRedisClient) {
  await initConsumerGroup(client, STREAM, ELASTICSEARCH_ROOMS_GROUP)
}

export async function searchRooms({
  redis,
  db,
  ackId,
  messages
}: Parameters<Parameters<typeof createParser>[1]>[0]) {
  if (messages[0] === RoomQueueType.INIT) {
    await initAlias(redis)
    logger.info('[init:elasticsearch:rooms]')
  } else if (messages[0] === RoomQueueType.ROOM) {
    const roomIds = JSON.parse(messages[1])

    await _insertRooms(db, roomIds)

    logger.info('[insert:elasticsearch:rooms]', roomIds.length)
  }
  await redis.xack(STREAM, ELASTICSEARCH_ROOMS_GROUP, ackId)
}

export async function consumeSearchRooms({
  redis,
  db
}: {
  redis: ExRedisClient
  db: MongoClient
}) {
  const parser = createParser({ redis, db }, searchRooms)
  await consumeGroup(
    redis,
    ELASTICSEARCH_ROOMS_GROUP,
    'consume-backend',
    STREAM,
    parser
  )
}
