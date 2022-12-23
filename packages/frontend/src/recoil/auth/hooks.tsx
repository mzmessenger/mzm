import type { AccessToken } from 'mzm-shared/type/auth'
import type { AUTH_API_RESPONSE } from 'mzm-shared/type/api'
import { COOKIES } from 'mzm-shared/auth/constants'
import { atom, useRecoilState, selector, useRecoilValue } from 'recoil'
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
    login: false,
    accessToken: defaultToken
  }
})

const loginState = selector({
  key: 'state:auth:selector:login',
  get: ({ get }) => {
    const { login } = get(authState)
    return login
  }
})
export const useLoginFlag = () => useRecoilValue(loginState)

export const useAuth = () => {
  const [auth, setAuth] = useRecoilState(authState)

  const logout = () => {
    if (auth.login) {
      location.href = '/auth/logout'
      setAuth({ login: false, accessToken: '' })
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
      setAuth({ login: true, accessToken: body.accessToken })
      return body
    }
    logout()
    return { accessToken: '', user: null }
  }

  const getAccessToken = async () => {
    try {
      const decoded = jwt_decode<JwtPayload>(auth.accessToken)
      if (decoded.exp - 10 * 1000 <= Math.floor(Date.now() / 1000)) {
        const res = await refreshToken()
        setAuth((current) => {
          return { ...current, accessToken: res.accessToken }
        })
        return { accessToken: res.accessToken, user: res.user }
      }
      const user = (decoded as any).user as AccessToken['user']
      setAuth((current) => {
        return { ...current, login: true }
      })
      return { accessToken: auth.accessToken, user }
    } catch (e) {
      return { accessToken: '', user: null }
    }
  }

  return {
    login: () => setAuth((current) => ({ ...current, login: true })),
    logout,
    getAccessToken,
    refreshToken
  } as const
}
