import { useState, useContext } from 'react'
import jwt_decode, { JwtPayload } from 'jwt-decode'
import { AuthDispatchContext } from './index'

export const useDispatchAuth = () => {
  return useContext(AuthDispatchContext)
}

const createDefaultToken = () => {
  try {
    const [, token] = document.cookie
      .split(';')
      .find((row) => row.includes('mzm-jwt-token'))
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
    const res = await fetch('/auth/jwt/refresh', {
      credentials: 'include',
      method: 'POST'
    })
    if (res.status === 200) {
      // @todo type
      const body = (await res.json()) as { accessToken: string }
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
