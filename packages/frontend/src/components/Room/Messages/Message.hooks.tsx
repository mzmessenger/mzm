import { useRef, useEffect, useMemo, useCallback } from 'react'
import dayjs from 'dayjs'
import { useMessageById } from '../../../state/messages/hooks'
import { useUserAccount } from '../../../state/user/hooks'
import { usePostTextArea } from '../../../state/postTextArea/hooks'
import { useSocketActions } from '../../../state/socket/hooks'
import { isReplied } from '../../../lib/util'

export const useMessage = (id: string) => {
  const { userAccount } = useUserAccount()
  const messageObj = useMessageById(id)
  const { startToEdit } = usePostTextArea()
  const { incrementIine, sendDeleteMessage } = useSocketActions()

  type Message = Pick<
    typeof messageObj,
    | 'message'
    | 'iine'
    | 'html'
    | 'icon'
    | 'vote'
    | 'updated'
    | 'removed'
    | 'userId'
  > & {
    date: string
    account: string
    replied: boolean
  }

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
  } = useMemo<Message>(() => {
    const init: Message = {
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

    const replied = isReplied(userAccount, messageObj.message)

    return {
      ...messageObj,
      date,
      account,
      replied
    }
  }, [messageObj, userAccount])

  const iineHandler = useCallback(() => {
    incrementIine(id)
  }, [incrementIine, id])

  const deleteHandler = useCallback(() => {
    sendDeleteMessage(id)
  }, [id, sendDeleteMessage])

  const startEditHandler = useCallback(() => {
    startToEdit(id, message)
  }, [id, message, startToEdit])

  const prevIineRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    prevIineRef.current = messageObj?.iine ?? undefined
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
