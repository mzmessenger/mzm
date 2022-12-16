import type { AUTH_API_RESPONSE } from 'mzm-shared/type/api'
import { COOKIES } from 'mzm-shared/auth/constants'
import { useState, useContext } from 'react'
import jwt_decode, { type JwtPayload } from 'jwt-decode'
import { AuthDispatchContext } from './index'

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
  const [accessToken, setAccessToken] = useState<string>(defaultToken)

  const refreshToken = async () => {
    type ResponseType = AUTH_API_RESPONSE['/auth/refresh/token']['POST']['body']

    const res = await fetch('/auth/refresh/token', {
      credentials: 'include',
      method: 'POST'
    })
    if (res.status === 200) {
      const body = (await res.json()) as ResponseType[200]
      setAccessToken(body.accessToken)
      return body
    }
    // @todo logout
    setAccessToken('')
    return { accessToken: '' }
  }

  const getAccessToken = async () => {
    try {
      const decoded = jwt_decode<JwtPayload>(accessToken)
      if (decoded.exp <= Math.floor(Date.now() / 1000)) {
        const res = await refreshToken()
        return res.accessToken
      }
      return accessToken
    } catch (e) {
      return ''
    }
  }

  return {
    getAccessToken
  } as const
}
