import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useSocket } from './recoil/socket/hooks'
import { useUserAccount, useMyInfoActions } from './recoil/user/hooks'
import { useAuth, useLoginFlag } from './recoil/auth/hooks'
import { getRoomName } from './lib/util'
import { useUiActions } from './recoil/ui/hooks'
import { logger } from './lib/logger'

const useRouter = () => {
  const login = useLoginFlag()
  const { getAccessToken, logout } = useAuth()
  const { fetchMyInfo } = useMyInfoActions({ getAccessToken, logout })

  useEffect(() => {
    if (!login) {
      getAccessToken().then(({ accessToken }) => {
        if (accessToken) {
          fetchMyInfo()
        }
      })
    }
  }, [getAccessToken, fetchMyInfo, login])

  useEffect(() => {
    try {
      const room = getRoomName(location.pathname)

      if (room) {
        document.title = `MZM (${room})`
      } else {
        document.title = `MZM`
      }
    } catch (e) {
      logger.error(e)
    }
  }, [])
}

const useResize = () => {
  const { onResize } = useUiActions()

  useEffect(() => {
    onResize(window.innerWidth, window.innerHeight)

    const handleResize = () => {
      onResize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [onResize])
}

export const useApp = (url: string) => {
  useRouter()
  useResize()

  const { login, getAccessToken, logout } = useAuth()
  const { userAccount } = useUserAccount()
  const location = useLocation()
  const { init } = useSocket({
    getAccessToken,
    userAccount,
    logout,
    pathname: location.pathname
  })

  useEffect(() => {
    if (login) {
      init({ url })
    }
  }, [login, init, url])
}
