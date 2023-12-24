/// <reference types='vite/client' />
import { wrap, type Remote } from 'comlink'
import { set, get, remove } from '../cookie'
import { AUTH_URL_BASE, REDIRECT_URI } from '../../constants'
import { logger } from '../logger'
import { dispatchAuthorizedEvent } from '../events'
import {
  type AuthProxy,
  type Cache,
  messages
} from '../../worker/authProxy/index'

const cacheKey = 'mzm:transaction'
let instance: Remote<AuthProxy> | null = await init()

async function getInstance(): Promise<Remote<AuthProxy>> {
  if (!instance) {
    instance = await init()
  }
  return instance
}

async function init() {
  const ProxyedWorker = await import('../../worker/authProxy/index?worker')
  const worker = new ProxyedWorker.default()
  worker.addEventListener('message', (e) => {
    if (e.data.type === messages.authorized) {
      dispatchAuthorizedEvent()
    }
  })
  const Worker = wrap<typeof AuthProxy>(worker)

  const cacheStr = get(cacheKey)
  let cache: Cache = undefined
  try {
    if (cacheStr) {
      // @todo safeParse
      cache = JSON.parse(cacheStr) as {
        code_verifier: string
        code_challenge: string
      }
    }
  } catch (e) {
    logger.warn(e)
  }
  return await new Worker(cache)
}

export async function proxyRequest(
  ...args: Parameters<AuthProxy['proxyRequest']>
) {
  return (await getInstance()).proxyRequest(...args)
}

// @todo remove
export async function getAccessToken() {
  return (await getInstance()).getAccessToken()
}

export async function pkceChallenge() {
  const { code_verifier, code_challenge } = await (
    await getInstance()
  ).pkceChallenge()
  return { code_verifier, code_challenge }
}

export function savePkceChallenge(options: {
  code_verifier: string
  code_challenge: string
}) {
  set(cacheKey, JSON.stringify(options), {
    expires: 1000 * 60 * 12
  })
}

export async function authTokenAfterRedirect(code: string) {
  const res = await (await getInstance()).authToken(code)
  if (res.success) {
    remove(cacheKey)
  }
  return res
}

class AuthorizationErrorResponse extends Error {
  status: number = 500
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const runIframe = async (
  code_challenge: string,
  state: string,
  redirect_uri: string
) => {
  return new Promise<{ code: string }>((resolve, reject) => {
    const iframe = window.document.createElement('iframe')
    iframe.setAttribute('width', '0')
    iframe.setAttribute('height', '0')
    iframe.style.display = 'none'

    const removeIframe = () => {
      if (window.document.body.contains(iframe)) {
        window.document.body.removeChild(iframe)
        window.removeEventListener('message', iframeEventHandler, false)
      }
    }

    const timeoutSetTimeoutId = setTimeout(() => {
      reject(new Error('timeout'))
      removeIframe()
    }, 30 * 1000)

    const iframeEventHandler = (e: MessageEvent) => {
      if (e.origin !== AUTH_URL_BASE) return
      if (!e.data) return
      if (e.data.type === 'authorization_error_response') {
        removeIframe()
        return reject(
          new AuthorizationErrorResponse(
            'authorization_error_response',
            e.data.response.status
          )
        )
      }
      if (e.data.type !== 'authorization_response') return

      if (state !== e.data.response.state) return

      e.data.response.error
        ? reject(new Error('response error'))
        : resolve(e.data.response as { code: string }) // @todo parse

      clearTimeout(timeoutSetTimeoutId)
      window.removeEventListener('message', iframeEventHandler, false)

      setTimeout(removeIframe, 10 * 1000)
    }

    window.addEventListener('message', iframeEventHandler, false)
    window.document.body.appendChild(iframe)
    const query = new URLSearchParams([
      ['code_challenge', code_challenge],
      ['state', state],
      ['redirect_uri', redirect_uri]
    ])
    iframe.setAttribute('src', `${AUTH_URL_BASE}/authorize?${query.toString()}`)
  })
}

async function _getAccessTokenFromIframe() {
  const state = generateState()
  const instance = await getInstance()
  const { code_challenge, code_verifier } = await instance.pkceChallenge()
  const { code } = await runIframe(code_challenge, state, REDIRECT_URI)
  const res = await instance.authToken(code, code_verifier)
  return res
}

export async function getAccessTokenFromIframe() {
  let res: Awaited<ReturnType<typeof _getAccessTokenFromIframe>> = {
    success: false,
    status: 500
  }
  for (let i = 0; i < 5; i++) {
    try {
      res = await _getAccessTokenFromIframe()
      if (res) {
        break
      }
    } catch (e) {
      if (e instanceof AuthorizationErrorResponse) {
        continue
      }
      break
    }
  }
  return res
}

function generateState() {
  const mask =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_~.'
  const randomValues = crypto.getRandomValues(new Uint8Array(43))

  let random = ''
  for (const value of randomValues) {
    random += mask[value % mask.length]
  }

  return random
}
