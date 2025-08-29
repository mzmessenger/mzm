import { useCallback } from 'react'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { logger } from '../../lib/logger'
import {
  getAccessTokenFromIframe,
  authTokenAfterRedirect as authTokenAfterRedirectBase
} from '../../lib/auth'
import { userState } from '../user/hooks'
import { AUTH_URL_BASE } from '../../constants'

const loginState = atom(false)

export const useLoginFlag = () => {
  return useAtomValue(loginState)
}

export const useAuth = () => {
  const [loginFlag, setLoginFlag] = useAtom(loginState)
  const setUser = useSetAtom(userState)

  const logout = useCallback(() => {
    location.href = AUTH_URL_BASE + '/auth/logout'
    logger.info('mzm:logout')
    setLoginFlag(false)
  }, [setLoginFlag])

  const authTokenAfterRedirect = useCallback(async (code: string) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const init = useCallback(async () => {
    try {
      const res = await getAccessTokenFromIframe()
      logger.info('mzm:auth:init', res.success)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    loginFlag,
    init,
    authTokenAfterRedirect,
    getAccessTokenFromIframe,
    logout
  } as const
}
