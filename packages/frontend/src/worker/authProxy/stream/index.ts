import { API_URL_BASE } from '../../../constants'
import { sleep } from '../../../lib/util'
import { logger } from '../../../lib/logger'
import { incrementRecconectAttenmpts, initRecconect, isMax } from './reconnect'
import { messages } from '../index'

const recconect = initRecconect()

let isConnected = false

type Options = {
  getAccessToken: () => string
}

export async function consumeSocket(options: Options) {
  if (isConnected) {
    return
  }
  isConnected = true
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await _consumeSocket(options).catch((e) => logger.warn(e))
    if (isMax(recconect)) {
      logger.error('over max recconect', recconect.attempts)
      break
    }
    await sleep(recconect.interval)
  }
}

async function _consumeSocket(options: Options) {
  const token = options.getAccessToken()
  if (!token) {
    incrementRecconectAttenmpts(recconect)
    return Promise.reject('no token')
  }
  initRecconect()

  const res = await fetch(`${API_URL_BASE}/api/socket`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  if (!res.ok || res.status !== 200) {
    logger.warn(res)
    incrementRecconectAttenmpts(recconect)
    return
  }

  const reader = res.body
    .pipeThrough(new TransformStream(transformContent))
    .getReader()
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read()
    if (!value || value === 'ping') {
      continue
    }
    try {
      const message = JSON.parse(value)
      self.postMessage({
        type: messages.message,
        payload: message
      })
    } catch (e) {
      logger.warn(e)
    }
    if (done) {
      break
    }
  }
}

const transformContent: Transformer = {
  start() {
    this.decoder = new TextDecoder(this.encoding, this.options)
    this.chunks = []
  },
  async transform(chunk, controller) {
    chunk = await chunk
    for (const c of chunk) {
      if (c === 0) {
        controller.enqueue(
          this.decoder.decode(new Uint8Array(this.chunks), { stream: true })
        )
        this.chunks = []
      } else {
        this.chunks.push(c)
      }
    }
  },
  flush() {}
}
