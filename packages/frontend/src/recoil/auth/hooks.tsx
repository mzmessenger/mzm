import type { AccessToken } from 'mzm-shared/type/auth'
import type { AUTH_API_RESPONSE } from 'mzm-shared/type/api'
import { COOKIES } from 'mzm-shared/auth/constants'
import { atom, useRecoilState, useRecoilValue } from 'recoil'
import jwt_decode, { type JwtPayload } from 'jwt-decode'
import dayjs from 'dayjs'
import { sleep } from '../../lib/util'
import { getCodeVerifier } from '../../lib/auth'
import { logger } from '../../lib/logger'
import { AUTH_URL_BASE } from '../../constants'

const createDefaultToken = () => {
  try {
    const [, token] = document.cookie
      .split(';')
      .find((row) => row.includes(COOKIES.ACCESS_TOKEN))
      .split('=')
    return token ?? ''
  } catch (e) {
    return ''
  }
}
const defaultToken = createDefaultToken()

const loginState = atom({
  key: 'state:auth:loginFlag',
  default: false
})

const authState = atom({
  key: 'state:auth',
  default: {
    accessToken: defaultToken
  }
})

export const useLoginFlag = () => useRecoilValue(loginState)

export const useAuth = () => {
  const [loginFlag, setLoginFlag] = useRecoilState(loginState)
  const [auth, setAuth] = useRecoilState(authState)

  const logout = () => {
    if (loginFlag) {
      location.href = AUTH_URL_BASE + '/auth/logout'
      setAuth({ accessToken: '' })
      setLoginFlag(false)
    }
  }

  // @todo
  const authToken = async (code: string) => {
    type ResponseType = AUTH_API_RESPONSE['/auth/token']['POST']['body']

    const codeVerifier = getCodeVerifier()
    const res = await fetch(AUTH_URL_BASE + '/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({
        code,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
      })
    })

    if (res.status === 200) {
      const body = (await res.json()) as ResponseType[200]
      setAuth({ accessToken: body.accessToken })
    }
  }

  // @todo remove
  const refreshToken = async () => {
    type ResponseType = AUTH_API_RESPONSE['/auth/token/refresh']['POST']['body']

    const MAX_RETRY_COUNT = 5
    for (let i = 0; i < MAX_RETRY_COUNT; i++) {
      const res = await fetch('/auth/token/refresh', {
        credentials: 'include',
        method: 'POST'
      })
      if (res.status === 200) {
        const body = (await res.json()) as ResponseType[200]
        setAuth({ accessToken: body.accessToken })
        setLoginFlag(false)
        return body
      }
      if (i < MAX_RETRY_COUNT) {
        await sleep(100)
      }
    }
    // @todo
    console.warn('refresh token failed')
    return { accessToken: '', user: null }
  }

  const getAccessToken = async () => {
    if (!auth.accessToken) {
      return { accessToken: '', user: null }
    }
    try {
      const decoded = jwt_decode<JwtPayload & AccessToken>(auth.accessToken)
      const exp = dayjs(new Date(decoded.exp * 1000))
        .subtract(5, 'minute')
        .valueOf()
      if (exp <= Date.now()) {
        const res = await refreshToken()
        setAuth({ accessToken: res.accessToken })
        if (res.accessToken) {
          setLoginFlag(true)
        }
        return { accessToken: res.accessToken, user: res.user }
      }
      setLoginFlag(true)
      return { accessToken: auth.accessToken, user: decoded.user }
    } catch (e) {
      logger.error(e)
      return { accessToken: '', user: null }
    }
  }

  return {
    loginFlag: loginFlag,
    login: () => {
      getAccessToken()
    },
    logout,
    getAccessToken,
    refreshToken,
    authToken
  } as const
}
