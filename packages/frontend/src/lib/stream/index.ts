// @todo move service worker
import { API_URL_BASE } from '../../constants'
import { getAccessToken } from '../auth'
import { sleep } from '../util'
import { logger } from '../logger'
import { incrementRecconectAttenmpts, initRecconect, isMax } from './reconnect'
import { dispatchMessageEvent } from '../events'
import { sendSocket } from '../client'

const recconect = initRecconect()

let isConnected = false

export async function receiveStreamData() {
  if (isConnected) {
    return
  }
  isConnected = true
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await _receiveStreamData().catch((e) => logger.warn(e))
    if (isMax(recconect)) {
      logger.error('over max recconect', recconect.attempts)
      break
    }
    await sleep(recconect.interval)
  }
}

async function _receiveStreamData() {
  const token = await getAccessToken().then((token) => {
    if (!token) {
      incrementRecconectAttenmpts(recconect)
      return Promise.reject('no token')
    }
    initRecconect()
    return token
  })

  sendSocket({ cmd: 'socket:connection' })

  // @todo worker
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
    if (value === 'ping') {
      continue
    }
    try {
      const message = JSON.parse(value)
      dispatchMessageEvent(message)
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
