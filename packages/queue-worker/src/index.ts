import type { QueueEvent } from 'mzm-shared/src/lib/queue'

type Env = {
  EVENTS: Pick<Queue<QueueEvent>, 'send'>
  AUTH_SERVICE_URL: string
  BACKEND_SERVICE_URL: string
  QUEUE_SECRET: string
}

function isAuthorized(request: Request, secret: string) {
  return request.headers.get('authorization') === `Bearer ${secret}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasString(value: Record<string, unknown>, key: string) {
  return typeof value[key] === 'string'
}

function hasObjectId(value: Record<string, unknown>, key: string) {
  const candidate = value[key]
  return typeof candidate === 'string' && /^[a-f\d]{24}$/i.test(candidate)
}

function isQueueEvent(value: unknown): value is QueueEvent {
  if (
    !isRecord(value) ||
    !hasString(value, 'id') ||
    !hasString(value, 'type') ||
    !hasString(value, 'createdAt') ||
    !isRecord(value.payload)
  ) {
    return false
  }

  if (value.type === 'message') {
    return true
  }
  if (value.type === 'unread') {
    return (
      hasObjectId(value.payload, 'roomId') &&
      hasObjectId(value.payload, 'messageId')
    )
  }
  if (value.type === 'reply') {
    return (
      hasObjectId(value.payload, 'roomId') &&
      hasObjectId(value.payload, 'userId')
    )
  }
  if (value.type === 'vote') {
    return hasObjectId(value.payload, 'messageId')
  }
  if (value.type === 'removeUser') {
    return hasObjectId(value.payload, 'userId')
  }
  return false
}

export async function handleFetch(request: Request, env: Env) {
  const url = new URL(request.url)
  if (request.method !== 'POST' || url.pathname !== '/events') {
    return new Response('not found', { status: 404 })
  }
  if (!isAuthorized(request, env.QUEUE_SECRET)) {
    return new Response('unauthorized', { status: 401 })
  }

  let event: unknown
  try {
    event = await request.json()
  } catch {
    return new Response('invalid event', { status: 400 })
  }
  if (!isQueueEvent(event)) {
    return new Response('invalid event', { status: 400 })
  }
  await env.EVENTS.send(event)
  return new Response(null, { status: 202 })
}

async function postEvent(
  url: URL,
  event: QueueEvent,
  secret: string,
  fetcher: typeof fetch
) {
  const response = await fetcher(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(event)
  })
  if (!response.ok) {
    throw new Error(
      `queue callback failed: ${url.toString()} (${response.status})`
    )
  }
}

export async function dispatchEvent(
  event: QueueEvent,
  env: Env,
  fetcher: typeof fetch = fetch
) {
  if (event.type === 'removeUser') {
    await postEvent(
      new URL('/internal/queue/remove-user', env.AUTH_SERVICE_URL),
      event,
      env.QUEUE_SECRET,
      fetcher
    )
  }
  await postEvent(
    new URL('/internal/queue', env.BACKEND_SERVICE_URL),
    event,
    env.QUEUE_SECRET,
    fetcher
  )
}

export default {
  fetch: handleFetch,
  async queue(batch: MessageBatch<QueueEvent>, env: Env) {
    for (const message of batch.messages) {
      await dispatchEvent(message.body, env)
      message.ack()
    }
  }
} satisfies ExportedHandler<Env, QueueEvent>
