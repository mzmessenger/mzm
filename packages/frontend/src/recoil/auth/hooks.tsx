import type { AccessToken } from 'mzm-shared/type/auth'
import type { AUTH_API_RESPONSE } from 'mzm-shared/type/api'
import { COOKIES } from 'mzm-shared/auth/constants'
import { useCallback } from 'react'
import { atom, useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import jwt_decode, { type JwtPayload } from 'jwt-decode'
import dayjs from 'dayjs'
import { sleep } from '../../lib/util'
import { logger } from '../../lib/logger'
import {
  getAccessTokenFromIframe,
  authTokenAfterRedirect as authTokenAfterRedirectBase
} from '../../lib/auth'
import { userState } from '../user/hooks'
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
  const setUser = useSetRecoilState(userState)

  const logout = useCallback(() => {
    console.log('logout')
    location.href = AUTH_URL_BASE + '/auth/logout'
    setLoginFlag(false)
  }, [setLoginFlag])

  // @todo remove
  const refreshToken = async () => {
    type ResponseType = AUTH_API_RESPONSE['/auth/token']['POST']['body']

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
    logger.warn('refresh token failed')
    return { accessToken: '', user: null }
  }

  // @todo remove
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

  const authTokenAfterRedirect = async (code: string) => {
    try {
      const res = await authTokenAfterRedirectBase(code)
      if (res.success) {
        setUser((current) => ({
          ...current,
          twitterUserName: res.data.user.twitterUserName,
          githubUserName: res.data.user.githubUserName
        }))
      }
      setLoginFlag(res.success)
      return
    } catch (e) {
      setLoginFlag(false)
    }
  }

  const init = async () => {
    try {
      const res = await getAccessTokenFromIframe()
      if (res.success) {
        setUser((current) => ({
          ...current,
          twitterUserName: res.data.user.twitterUserName,
          githubUserName: res.data.user.githubUserName
        }))
      }
      setLoginFlag(res.success)
    } catch (e) {
      logger.warn(e)
      setLoginFlag(false)
    }
  }

  return {
    loginFlag,
    init,
    authTokenAfterRedirect,
    logout,
    getAccessToken,
    refreshToken
  } as const
}
