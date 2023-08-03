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
  const { fetchMyInfo } = useMyInfoActions()

  useEffect(() => {
    if (login === true) {
      fetchMyInfo()
    }
  }, [fetchMyInfo, login])

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

export const useApp = () => {
  useRouter()
  useResize()

  const { loginFlag, init: initAuth } = useAuth()
  const { userAccount } = useUserAccount()
  const location = useLocation()
  const { init: initSocket } = useSocket({
    userAccount,
    pathname: location.pathname
  })

  useEffect(() => {
    if (loginFlag) {
      initSocket()
    }
  }, [loginFlag, initSocket])

  useEffect(() => {
    initAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
