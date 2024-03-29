import * as config from '../../../config.js'
import { logger } from '../../logger.js'
import { client as redis } from '../../redis.js'
import {
  initAlias,
  insertRooms as _insertRooms
} from '../../elasticsearch/rooms.js'
import { initConsumerGroup, createParser, consumeGroup } from '../common.js'
import { RoomQueueType } from '../../../types.js'

const STREAM = config.stream.ELASTICSEARCH_ROOMS
const ELASTICSEARCH_ROOMS_GROUP = 'group:elasticsearch:rooms'

export const initSearchRoomConsumerGroup = async () => {
  await initConsumerGroup(STREAM, ELASTICSEARCH_ROOMS_GROUP)
}

export const searchRooms = async (ackid: string, messages: string[]) => {
  if (messages[0] === RoomQueueType.INIT) {
    await initAlias()
    logger.info('[init:elasticsearch:rooms]')
  } else if (messages[0] === RoomQueueType.ROOM) {
    const roomIds = JSON.parse(messages[1])

    await _insertRooms(roomIds)

    logger.info('[insert:elasticsearch:rooms]', roomIds.length)
  }
  await redis().xack(STREAM, ELASTICSEARCH_ROOMS_GROUP, ackid)
}

export const consumeSearchRooms = async () => {
  const parser = createParser(searchRooms)
  await consumeGroup(
    ELASTICSEARCH_ROOMS_GROUP,
    'consume-backend',
    STREAM,
    parser
  )
}
