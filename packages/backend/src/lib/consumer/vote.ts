import { ObjectId, type MongoClient } from 'mongodb'
import { TO_CLIENT_CMD } from 'mzm-shared/src/type/socket'
import type { EventPublisher, QueueEvent } from 'mzm-shared/src/lib/queue'
import { collections } from '../db.js'
import { logger } from '../logger.js'
import { getVoteAnswers } from '../../logic/vote.js'
import { getAllUserIdsInRoom } from '../../logic/users.js'
import { addQueueToUsers } from '../provider/index.js'

export async function vote({
  db,
  event,
  publisher
}: {
  db: MongoClient
  event: QueueEvent<'vote'>
  publisher: EventPublisher
}) {
  const { messageId: id } = event.payload
  const messageId = new ObjectId(id)
  const target = await collections(db).messages.findOne({ _id: messageId })
  if (!target) {
    return
  }
  const users = await getAllUserIdsInRoom(db, target.roomId.toHexString())
  const answers = await getVoteAnswers(db, messageId)

  await addQueueToUsers(publisher, users, {
    cmd: TO_CLIENT_CMD.VOTE_ANSWERS,
    messageId: id,
    answers
  })
  logger.info('[vote]', id)
}
