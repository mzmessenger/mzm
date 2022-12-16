import type { AccessToken } from 'mzm-shared/type/auth'
import type { AUTH_API_RESPONSE } from 'mzm-shared/type/api'
import { COOKIES } from 'mzm-shared/auth/constants'
import { useState, useContext } from 'react'
import jwt_decode, { type JwtPayload } from 'jwt-decode'
import { AuthContext, AuthDispatchContext } from './index'

export const useAuth = () => {
  return useContext(AuthContext)
}

export const useDispatchAuth = () => {
  return useContext(AuthDispatchContext)
}

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

export const useAuthForContext = () => {
  const [login, setLogin] = useState<boolean>(false)
  const [accessToken, setAccessToken] = useState<string>(defaultToken)

  const logout = () => {
    location.href = '/auth/logout'
    setLogin(false)
  }

  const refreshToken = async () => {
    type ResponseType = AUTH_API_RESPONSE['/auth/token/refresh']['POST']['body']

    const res = await fetch('/auth/token/refresh', {
      credentials: 'include',
      method: 'POST'
    })
    if (res.status === 200) {
      const body = (await res.json()) as ResponseType[200]
      setAccessToken(body.accessToken)
      setLogin(true)
      return body
    }
    setAccessToken('')
    logout()
    return { accessToken: '', user: null }
  }

  const getAccessToken = async () => {
    try {
      const decoded = jwt_decode<JwtPayload>(accessToken)
      if (decoded.exp <= Math.floor(Date.now() / 1000) - 10 * 1000) {
        const res = await refreshToken()
        return { accessToken: res.accessToken, user: res.user }
      }
      const user = (decoded as any).user as AccessToken['user']
      setLogin(true)
      return { accessToken, user }
    } catch (e) {
      return { accessToken: '', user: null }
    }
  }

  return {
    state: {
      login
    },
    login: () => setLogin(true),
    logout,
    getAccessToken,
    refreshToken
  } as const
}
