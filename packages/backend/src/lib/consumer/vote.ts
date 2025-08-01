import { type MongoClient, ObjectId } from 'mongodb'
import { TO_CLIENT_CMD } from 'mzm-shared/src/type/socket'
import * as config from '../../config.js'
import { VoteQueue } from '../../types.js'
import { collections } from '../db.js'
import { client } from '../redis.js'
import { logger } from '../logger.js'
import { initConsumerGroup, createParser, consumeGroup } from './common.js'
import { getVoteAnswers } from '../../logic/vote.js'
import { getAllUserIdsInRoom } from '../../logic/users.js'
import { addQueueToUsers } from '../provider/index.js'

const STREAM = config.stream.VOTE
const VOTE_GROUP = 'group:vote'

export async function initVoteConsumerGroup() {
  await initConsumerGroup(STREAM, VOTE_GROUP)
}

export async function vote(db: MongoClient, ackid: string, messages: string[]) {
  const queue = JSON.parse(messages[1]) as VoteQueue

  // @todo lazy 1min

  const messageId = new ObjectId(queue.messageId)
  const message = await collections(db).messages.findOne({
    _id: messageId
  })
  if (!message) {
    return
  }
  const users = await getAllUserIdsInRoom(db, message.roomId.toHexString())
  const answers = await getVoteAnswers(db, messageId)

  addQueueToUsers(users, {
    cmd: TO_CLIENT_CMD.VOTE_ANSWERS,
    messageId: queue.messageId,
    answers
  })

  await client().xack(STREAM, VOTE_GROUP, ackid)

  logger.info('[vote]', queue.messageId)
}

export async function consumeVote(db: MongoClient) {
  const parser = createParser(db, vote)
  await consumeGroup(VOTE_GROUP, 'consume-backend', STREAM, parser)
}
