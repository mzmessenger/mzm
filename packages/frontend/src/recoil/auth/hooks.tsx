import { useCallback } from 'react'
import { atom, useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import { logger } from '../../lib/logger'
import {
  getAccessTokenFromIframe,
  authTokenAfterRedirect as authTokenAfterRedirectBase
} from '../../lib/auth'
import { userState } from '../user/hooks'
import { AUTH_URL_BASE } from '../../constants'

const loginState = atom({
  key: 'state:auth:loginFlag',
  default: false
})

export const useLoginFlag = () => useRecoilValue(loginState)

export const useAuth = () => {
  const [loginFlag, setLoginFlag] = useRecoilState(loginState)
  const setUser = useSetRecoilState(userState)

  const logout = useCallback(() => {
    location.href = AUTH_URL_BASE + '/auth/logout'
    setLoginFlag(false)
  }, [setLoginFlag])

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
      return res.success
    } catch (e) {
      logger.warn(e)
      setLoginFlag(false)
      return false
    }
  }

  return {
    loginFlag,
    init,
    authTokenAfterRedirect,
    getAccessTokenFromIframe,
    logout
  } as const
}
