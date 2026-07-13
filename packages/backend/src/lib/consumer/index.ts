import type { MongoClient } from 'mongodb'
import type { EventPublisher, QueueEvent } from 'mzm-shared/src/lib/queue'
import { message } from './message.js'
import { increment } from './unread.js'
import { reply } from './reply.js'
import { vote } from './vote.js'
import { remove } from './remove.js'

export async function handleQueueEvent({
  db,
  publisher,
  event
}: {
  db: MongoClient
  publisher: EventPublisher
  event: QueueEvent
}) {
  if (event.type === 'message') {
    await message({ event })
  } else if (event.type === 'unread') {
    await increment({ db, event })
  } else if (event.type === 'reply') {
    await reply({ db, event })
  } else if (event.type === 'vote') {
    await vote({ db, publisher, event })
  } else if (event.type === 'removeUser') {
    await remove({ db, event })
  }
}
