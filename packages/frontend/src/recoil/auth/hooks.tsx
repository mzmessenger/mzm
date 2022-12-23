import type { AccessToken } from 'mzm-shared/type/auth'
import type { AUTH_API_RESPONSE } from 'mzm-shared/type/api'
import { COOKIES } from 'mzm-shared/auth/constants'
import { atom, useRecoilState, useRecoilValue } from 'recoil'
import jwt_decode, { type JwtPayload } from 'jwt-decode'
import { logger } from '../../lib/logger'

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
      location.href = '/auth/logout'
      setAuth({ accessToken: '' })
      setLoginFlag(false)
    }
  }

  const refreshToken = async () => {
    type ResponseType = AUTH_API_RESPONSE['/auth/token/refresh']['POST']['body']

    const res = await fetch('/auth/token/refresh', {
      credentials: 'include',
      method: 'POST'
    })
    if (res.status === 200) {
      const body = (await res.json()) as ResponseType[200]
      setAuth({ accessToken: body.accessToken })
      setLoginFlag(true)
      return body
    }
    logout()
    return { accessToken: '', user: null }
  }

  const getAccessToken = async () => {
    if (!auth.accessToken) {
      return { accessToken: '', user: null }
    }
    try {
      const decoded = jwt_decode<JwtPayload & AccessToken>(auth.accessToken)
      if (decoded.exp - 10 * 1000 <= Math.floor(Date.now() / 1000)) {
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
    refreshToken
  } as const
}
