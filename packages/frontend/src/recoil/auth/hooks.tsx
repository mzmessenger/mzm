import type { AccessToken } from 'mzm-shared/type/auth'
import type { AUTH_API_RESPONSE } from 'mzm-shared/type/api'
import { COOKIES } from 'mzm-shared/auth/constants'
import { atom, useRecoilState } from 'recoil'
import { useState } from 'react'
import jwt_decode, { type JwtPayload } from 'jwt-decode'

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

const authState = atom({
  key: 'state:auth',
  default: {
    login: false
  }
})

export const useAuth = () => {
  const [auth, setAuth] = useRecoilState(authState)
  const [accessToken, setAccessToken] = useState<string>(defaultToken)

  const logout = () => {
    location.href = '/auth/logout'
    setAuth({ login: false })
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
      setAuth({ login: true })
      return body
    }
    setAccessToken('')
    logout()
    return { accessToken: '', user: null }
  }

  const getAccessToken = async () => {
    try {
      const decoded = jwt_decode<JwtPayload>(accessToken)
      if (decoded.exp - 10 * 1000 <= Math.floor(Date.now() / 1000)) {
        const res = await refreshToken()
        return { accessToken: res.accessToken, user: res.user }
      }
      const user = (decoded as any).user as AccessToken['user']
      setAuth({ login: true })
      return { accessToken, user }
    } catch (e) {
      return { accessToken: '', user: null }
    }
  }

  return {
    state: auth,
    login: () => setAuth({ login: true }),
    logout,
    getAccessToken,
    refreshToken
  } as const
}
