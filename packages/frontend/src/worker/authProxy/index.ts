import type { AUTH_API_RESPONSE } from 'mzm-shared/type/api'
import { expose } from 'comlink'
import { pkceChallenge, verifyCodeChallenge } from './pkce'
import { AUTH_URL_BASE, SOCKET_URL } from '../../constants'

type TokenResponse = AUTH_API_RESPONSE['/auth/token']['POST']['body'][200]

export type Cache = {
  code_challenge?: string
  code_verifier?: string
}

export class AuthProxy {
  code_verifier: string | null = null
  #code_challenge: string | null = null
  #accessToken: string | null = null
  #user: TokenResponse['user'] | null = null

  constructor(cache?: Cache) {
    this.#code_challenge = cache?.code_challenge ?? null
    this.code_verifier = cache?.code_verifier ?? null
  }

  generateSocketUrl() {
    return `${SOCKET_URL}?token=${this.#accessToken}`
  }

  async proxyRequest(
    url: string,
    init?: {
      method?: RequestInit['method']
      headers?: Record<string, string>
      body?: string
    }
  ) {
    if (!this.#accessToken) {
      return { ok: false, status: 401, body: null }
    }
    const res = await fetch(url, {
      method: init?.method ?? 'GET',
      headers: {
        ...init.headers,
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${this.#accessToken}`
      }
    })
    const body = await res.json()
    if (res.ok) {
      return {
        ok: true,
        status: res.status,
        body: body
      }
    }
    return { ok: res.ok, status: res.status, body: body }
  }

  getUser() {
    return this.#user
  }

  async authToken(
    code: string,
    code_verifier?: string
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
      body: JSON.stringify({
        code,
        grant_type: 'authorization_code',
        code_verifier: code_verifier ? code_verifier : this.code_verifier
      })
    })

    if (res.status === 200) {
      const body = (await res.json()) as TokenResponse
      this.#accessToken = body.accessToken
      this.#user = body.user
      return { success: true, data: body }
    }
    return { success: false, status: res.status }
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
