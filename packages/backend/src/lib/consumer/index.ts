import type { MongoClient } from 'mongodb'
import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'
import { acceptConsumerEvent } from '../outbox.js'
import { message } from './message.js'
import { increment } from './unread.js'
import { reply } from './reply.js'
import { vote } from './vote.js'
import { remove } from './remove.js'

export async function handleQueueEvent({
  db,
  event
}: {
  db: MongoClient
  event: QueueWireEvent
}) {
  const wireEvent = event
  if (wireEvent.type === 'vote') {
    if (await acceptConsumerEvent(db, wireEvent, async () => undefined)) await vote({ db, event: wireEvent })
    return
  }
  if (!await acceptConsumerEvent(db, wireEvent, async (session) => {
    if (wireEvent.type === 'unread') await increment({ db, event: wireEvent, session })
    else if (wireEvent.type === 'reply') await reply({ db, event: wireEvent, session })
    else if (wireEvent.type === 'removeUser') await remove({ db, event: wireEvent, session })
  })) return
  if (wireEvent.type === 'message') {
    await message({ event: wireEvent })
  }
}
