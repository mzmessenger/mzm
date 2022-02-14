import { ObjectId } from 'mongodb'
import { TO_CLIENT_CMD } from 'mzm-shared/type/socket'
import * as config from '../../config'
import { VoteQueue } from '../../types'
import * as db from '../db'
import { client } from '../redis'
import { logger } from '../logger'
import { initConsumerGroup, createParser, consumeGroup } from './common'
import { getVoteAnswers } from '../../logic/vote'
import { getAllUserIdsInRoom } from '../../logic/users'
import { addQueueToUsers } from '../provider/index'

const STREAM = config.stream.VOTE
const VOTE_GROUP = 'group:vote'

export const initRenameConsumerGroup = async () => {
  await initConsumerGroup(STREAM, VOTE_GROUP)
}

export const vote = async (ackid: string, messages: string[]) => {
  const queue = JSON.parse(messages[1]) as VoteQueue

  // @todo lazy 1min

  const messageId = new ObjectId(queue.messageId)
  const message = await db.collections.messages.findOne({ _id: messageId })
  const users = await getAllUserIdsInRoom(message.roomId.toHexString())
  const answers = await getVoteAnswers(messageId)

  addQueueToUsers(users, {
    cmd: TO_CLIENT_CMD.VOTE_ANSWERS,
    messageId: queue.messageId,
    answers
  })

  await client.xack(STREAM, VOTE_GROUP, ackid)

  logger.info('[vote]', queue.messageId)
}

export const consumeVote = async () => {
  const parser = createParser(vote)
  await consumeGroup(VOTE_GROUP, 'consume-backend', STREAM, parser)
}
