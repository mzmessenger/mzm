import { useRef, useEffect, useMemo, useCallback } from 'react'
import dayjs from 'dayjs'
import { useMessages } from '../../../contexts/messages/hooks'
import { useUser } from '../../../contexts/user/hooks'
import { useDispatchPostTextArea } from '../../../contexts/postTextArea/hooks'
import { useSocket } from '../../../recoil/socket/hooks'
import { isReplied } from '../../../lib/util'

export const useMessage = (id: string) => {
  const { me } = useUser()
  const {
    messages: {
      byId: { [id]: messageObj }
    }
  } = useMessages()
  const { startToEdit } = useDispatchPostTextArea()
  const { incrementIine, sendDeleteMessage } = useSocket()

  const myAccount = useMemo(() => {
    return me?.account ?? ''
  }, [me])

  const {
    message,
    iine,
    html,
    icon,
    vote,
    updated,
    removed,
    date,
    account,
    userId,
    replied
  } = useMemo(() => {
    const init = {
      message: '',
      iine: 0,
      html: '',
      icon: '',
      vote: null,
      updated: false,
      removed: false,
      date: '',
      account: 'removed',
      userId: '',
      replied: false
    }
    if (!messageObj) {
      return init
    }

    const day = dayjs(new Date(Number(messageObj.createdAt)))
    const date = day.format(
      day.year() === new Date().getFullYear()
        ? 'MM/DD HH:mm:ss'
        : 'YYYY/MM/DD HH:mm:ss'
    )
    const account = messageObj.userAccount ?? ''

    const replied = isReplied(myAccount, messageObj.message)

    return {
      ...messageObj,
      date,
      account,
      replied
    }
  }, [messageObj, myAccount])

  const iineHandler = useCallback(() => {
    incrementIine(id)
  }, [incrementIine, id])

  const deleteHandler = useCallback(() => {
    sendDeleteMessage(id)
  }, [id, sendDeleteMessage])

  const startEditHandler = useCallback(() => {
    startToEdit(id, message)
  }, [id, message, startToEdit])

  const prevIineRef = useRef<number>()
  useEffect(() => {
    prevIineRef.current = messageObj.iine ?? undefined
  })

  return {
    message,
    account,
    userId,
    iine,
    html,
    icon,
    vote,
    updated,
    removed,
    date,
    replied,
    beforeIine: prevIineRef.current,
    iineHandler,
    deleteHandler,
    startEditHandler
  } as const
}
