import { createHttpEventPublisher } from 'mzm-shared/src/lib/queue'
import { QUEUE_SECRET, QUEUE_URL } from '../config.js'

export type { EventPublisher } from 'mzm-shared/src/lib/queue'

export function createEventPublisher() {
  return createHttpEventPublisher({
    url: QUEUE_URL,
    secret: QUEUE_SECRET
  })
}
