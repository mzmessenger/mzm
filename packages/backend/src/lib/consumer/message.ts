import type { QueueWireEvent } from 'mzm-shared/src/lib/outbox'
import { logger } from '../logger.js'
import { sendToUser } from '../fetchStreaming.js'

export async function message({ event }: { event: QueueWireEvent<'message'> }) {
  const data = event.payload
  logger.info({ label: 'consume:message', message: data })
  if (data.user) {
    sendToUser(data.user, Buffer.from(JSON.stringify(data)))
  }
}
