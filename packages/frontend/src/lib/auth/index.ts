import type { AuthProxy, Cache } from '../../worker/authProxy/index'
import { wrap } from 'comlink'
import { set, get, remove } from '../cookie'
import { AUTH_URL_BASE, REDIRECT_URI } from '../../constants'
import { logger } from '../logger'

const cacheKey = 'mzm:transaction'
const worker = await init()

async function init() {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const ProxyedWorker = await import('../../worker/authProxy/index?worker')
  const Worker = wrap<typeof AuthProxy>(new ProxyedWorker.default())

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
  return worker.proxyRequest(...args)
}

export async function proxyRequestWithFormData(
  ...args: Parameters<AuthProxy['proxyRequestWithFormData']>
) {
  return worker.proxyRequestWithFormData(...args)
}

export async function generateSocketUrl() {
  return worker.generateSocketUrl()
}

export async function pkceChallenge() {
  const { code_verifier, code_challenge } = await worker.pkceChallenge()
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
  const res = await worker.authToken(code)
  if (res.success) {
    remove(cacheKey)
  }
  return res
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
    }, 60 * 1000)

    const iframeEventHandler = (e: MessageEvent) => {
      if (e.origin !== AUTH_URL_BASE) return
      if (!e.data || e.data.type !== 'authorization_response') return

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

export async function getAccessTokenFromIframe() {
  const state = generateState()
  const { code_challenge, code_verifier } = await worker.pkceChallenge()
  const { code } = await runIframe(code_challenge, state, REDIRECT_URI)
  const res = await worker.authToken(code, code_verifier)
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
