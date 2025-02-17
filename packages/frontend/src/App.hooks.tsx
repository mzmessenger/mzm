import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useMessageListener } from './state/socket/hooks'
import { useMyInfoActions } from './state/user/hooks'
import { useAuth, useLoginFlag } from './state/auth/hooks'
import { getRoomName } from './lib/util'
import { useUiActions } from './state/ui/hooks'
import { logger } from './lib/logger'
import { comsumeSocket } from './lib/auth'
import { events, type MessageEvent } from './lib/events'

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
    onResize(window.innerWidth)

    const handleResize = () => {
      onResize(window.innerWidth)
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

  const { init: initAuth } = useAuth()
  const location = useLocation()
  const { handlers } = useMessageListener({ pathname: location.pathname })

  useEffect(() => {
    initAuth()

    function authoriaedListener() {
      logger.info(events.authorized)
      comsumeSocket()
    }
    function messageListener(e: MessageEvent) {
      logger.info(events.message, e.detail)

      if (handlers[e.detail.cmd]) {
        const handler = handlers[e.detail.cmd]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler({ message: e.detail } as any)
      }
    }
    window.addEventListener(events.authorized, authoriaedListener)
    window.addEventListener(events.message, messageListener)

    return () => {
      window.removeEventListener(events.authorized, authoriaedListener)
      window.removeEventListener(events.message, messageListener)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
