import type { AuthAPI } from 'mzm-shared/src/api/universal'
import type { AccessToken } from 'mzm-shared/src/type/auth'
import { jwtDecode, type JwtPayload } from 'jwt-decode'
import { expose } from 'comlink'
import dayjs from 'dayjs'
import { pkceChallenge, verifyCodeChallenge } from './pkce'
import { AUTH_URL_BASE } from '../../constants'
import { logger } from '../../lib/logger'
import { consumeSocket } from './stream/index'

type TokenResponse = AuthAPI['/auth/token']['POST']['response'][200]['body']

export type Cache = {
  code_challenge?: string
  code_verifier?: string
}

type DecodeAccessToken =
  | { expired: boolean; user: AccessToken['user'] }
  | { expired: true; user: null }

const decodeAccessToken = (accessToken: string): DecodeAccessToken => {
  if (!accessToken) {
    return { expired: true, user: null }
  }
  try {
    const decoded = jwtDecode<JwtPayload & AccessToken>(accessToken)
    const exp = dayjs(new Date(decoded.exp * 1000))
      .subtract(20, 'minute')
      .valueOf()
    return { expired: exp <= Date.now(), user: decoded.user }
  } catch (e) {
    logger.error(e)
    return { expired: true, user: null }
  }
}

export const messages = {
  authorized: 'mzm:worker:authorized',
  message: 'mzm:worker:message'
} as const

export class AuthProxy {
  code_verifier: string | null = null
  #code_challenge: string | null = null
  #accessToken: string | null = null
  #refreshToken: string | null = null
  // eslint-disable-next-line no-unused-private-class-members
  #user: TokenResponse['user'] | null = null

  constructor(cache?: Cache) {
    this.#code_challenge = cache?.code_challenge ?? null
    this.code_verifier = cache?.code_verifier ?? null
    setInterval(
      () => {
        if (!this.#accessToken) {
          return
        }
        const decode = decodeAccessToken(this.#accessToken)
        if (decode.expired) {
          this.#authTokenWithRefresh()
        }
      },
      10 * 60 * 1000
    )
  }

  getAccessToken() {
    if (!this.#accessToken) {
      return ''
    }
    return this.#accessToken
  }

  async proxyRequest(
    url: string,
    options?: {
      method?: RequestInit['method']
      headers?: Record<string, string>
      body?: string | FormData
      form?: { [key: string]: string | Blob }
      bodyParser?: 'json' | 'text'
    }
  ) {
    if (!this.#accessToken) {
      return { ok: false, status: 401, body: null }
    }
    const init = {
      ...options,
      method: options?.method ?? 'GET',
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.#accessToken}`
      }
    }

    if (options.form) {
      const formData = new FormData()
      for (const [key, data] of Object.entries(options.form)) {
        formData.append(key, data)
      }
      init.body = formData
    }

    try {
      const res = await fetch(url, init)
      if (res.status === 500) {
        return { ok: res.ok, status: res.status, body: await res.text() }
      }
      const body =
        options.bodyParser === 'text' ? await res.text() : await res.json()
      if (res.ok) {
        return {
          ok: true,
          status: res.status,
          body: body
        }
      }
      return { ok: res.ok, status: res.status, body: body }
    } catch (e) {
      logger.error(e)
      return { ok: false, status: 500, body: null }
    }
  }

  async comsumeSocket() {
    await consumeSocket({
      getAccessToken: () => this.#accessToken
    })
  }

  async #authTokenBase(
    body:
      | {
          grant_type: 'refresh_token'
          refresh_token: string
        }
      | {
          code: string
          grant_type: 'authorization_code'
          code_verifier: string
        }
  ): Promise<
    | {
        success: true
        data: TokenResponse
      }
    | { success: false; status: number }
  > {
    const res = await fetch(AUTH_URL_BASE + '/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(body)
    })

    if (res.status === 200) {
      const body = (await res.json()) as TokenResponse
      this.#accessToken = body.accessToken
      this.#refreshToken = body.refreshToken
      this.#user = body.user
      self.postMessage({
        type: messages.authorized
      })
      return { success: true, data: body }
    }
    return { success: false, status: res.status }
  }
  async #authTokenWithRefresh() {
    return this.#authTokenBase({
      grant_type: 'refresh_token',
      refresh_token: this.#refreshToken
    })
  }

  async authToken(code: string, code_verifier?: string) {
    return this.#authTokenBase({
      code,
      grant_type: 'authorization_code',
      code_verifier: code_verifier ? code_verifier : this.code_verifier
    })
  }

  async pkceChallenge() {
    const res = await pkceChallenge()
    this.code_verifier = res.code_verifier
    return {
      code_verifier: res.code_verifier,
      code_challenge: res.code_challenge
    }
  }

  async verifyCodeChallenge(code_verifier: string, code_challenge?: string) {
    const res = await verifyCodeChallenge(
      code_verifier,
      code_challenge ? code_challenge : this.#code_challenge
    )
    return res
  }
}

expose(AuthProxy, self)
