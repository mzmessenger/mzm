import { useRef, useEffect, useMemo, useCallback } from 'react'
import dayjs from 'dayjs'
import { useMessages } from '../../../contexts/messages/hooks'
import { useUser } from '../../../contexts/user/hooks'
import { useDispatchPostTextArea } from '../../../contexts/postTextArea/hooks'
import { useDispatchSocket } from '../../../contexts/socket/hooks'
import { isReplied } from '../../../lib/util'

export const useMessage = (id: string) => {
  const { me } = useUser()
  const {
    messages: {
      byId: { [id]: messageObj }
    }
  } = useMessages()
  const { startToEdit } = useDispatchPostTextArea()
  const { incrementIine } = useDispatchSocket()

  const { message, iine, html, icon, vote, updated, date, account, replied } =
    useMemo(() => {
      const init = {
        message: '',
        iine: 0,
        html: '',
        icon: '',
        vote: null,
        updated: '',
        date: '',
        account: '',
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
      const account = messageObj.userAccount
        ? messageObj?.userAccount ?? ''
        : message?.userId ?? ''
      const replied = isReplied(me.account, messageObj.message)

      return {
        ...messageObj,
        date,
        account,
        replied
      }
    }, [messageObj, me.account])

  const iineHandler = useCallback(() => {
    incrementIine(id)
  }, [incrementIine, id])

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
    iine,
    html,
    icon,
    vote,
    updated,
    date,
    replied,
    beforeIine: prevIineRef.current,
    myAccount: me.account,
    iineHandler,
    startEditHandler
  } as const
}
