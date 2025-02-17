import type { MessageType } from 'mzm-shared/src/type/socket'
import type { useSocketActions } from '../../state/socket/hooks'
import { useCallback } from 'react'
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai'
import { convertToHtml } from '../../lib/message'

import { TO_CLIENT_CMD, FilterToClientType } from 'mzm-shared/src/type/socket'

type SocketMessageType = FilterToClientType<
  typeof TO_CLIENT_CMD.MESSAGE_RECEIVE
>['message'] & { html?: string }

export type VoteAnswerType = SocketMessageType['vote']['answers'][number]

export type StateMessageType = SocketMessageType

type MessageById = {
  [key: string]: StateMessageType
}

const messagesByIdState = atom<MessageById>({})

export const useMessageById = (roomId: string) => {
  return (
    useAtomValue(messagesByIdState)[roomId] ?? (null satisfies StateMessageType)
  )
}

type VoteAnswersById = {
  [key: string]: {
    [key: number]: VoteAnswerType[]
  }
}

const voteAnswersByIdState = atom<VoteAnswersById>({})

export const useVoteAnswerByIdAndIndex = (messageId: string, index: number) => {
  const byId = useAtomValue(voteAnswersByIdState)
  if (!byId[messageId]) {
    return []
  }
  const answers = byId[messageId]
  return answers[index] ?? []
}

type MessagesState = {
  messagesAllIds: string[] | readonly []
}

const messagesState = atom<MessagesState>({
  messagesAllIds: []
})

type UseSocketActions = ReturnType<typeof useSocketActions>

export const useVoteSocket = ({
  sendVoteAnswerSocket,
  removeVoteAnswerSocket
}: {
  sendVoteAnswerSocket: UseSocketActions['sendVoteAnswer']
  removeVoteAnswerSocket: UseSocketActions['removeVoteAnswer']
}) => {
  const setVoteAnswersById = useSetAtom(voteAnswersByIdState)

  const createVoteAnswers = (
    state: VoteAnswersById,
    messageId: string,
    index: number,
    answers: VoteAnswerType[]
  ): VoteAnswersById => {
    return {
      [messageId]: {
        ...state[messageId],
        [index]: answers
      }
    }
  }

  const sendVoteAnswer = (
    messageId: string,
    index: number,
    answer: number,
    user: {
      userId: string
      userAccount: string
      userIconUrl: string
    }
  ) => {
    setVoteAnswersById((current) => {
      const answers = (current[messageId][index] ?? []).filter((e) => {
        return e.userId !== user.userId
      })

      answers.push({
        userId: user.userId,
        userAccount: user.userAccount,
        icon: user.userIconUrl,
        index: index,
        answer: answer
      })

      const add = createVoteAnswers(current, messageId, index, answers)
      return { ...current, ...add }
    })

    sendVoteAnswerSocket(messageId, index, answer)
  }

  const removeVoteAnswer = (
    messageId: string,
    index: number,
    userId: string
  ) => {
    setVoteAnswersById((current) => {
      const answers = current[messageId][index].filter(
        (e) => e.userId !== userId
      )

      const add = createVoteAnswers(current, messageId, index, answers)
      return { ...current, ...add }
    })

    removeVoteAnswerSocket(messageId, index)
  }

  return {
    sendVoteAnswer,
    removeVoteAnswer
  } as const
}

const convertMessage = async (
  m: MessageType
): Promise<{
  message: StateMessageType
  vote: VoteAnswersById[string]
}> => {
  const message: StateMessageType = {
    id: m.id,
    userId: m.userId,
    icon: m.icon,
    userAccount: m.userAccount,
    message: m.message,
    iine: m.iine,
    vote: m.vote,
    updated: m.updated,
    removed: m.removed,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt
  }
  message.html = await convertToHtml(m.message)

  const createVote = () => {
    if (!m.vote) {
      return {}
    }

    const vote = m.vote.answers.reduce(
      (byIndex, answer) => {
        byIndex[answer.index] = byIndex[answer.index] ?? []
        byIndex[answer.index].push(answer)
        return byIndex
      },
      {} as VoteAnswersById[string]
    )

    return vote
  }

  return { message, vote: createVote() }
}

export const useMessagesForSocket = () => {
  const [messagesById, setMessagesById] = useAtom(messagesByIdState)
  const setVoteAnswersById = useSetAtom(voteAnswersByIdState)
  const [messages, setMessages] = useAtom(messagesState)

  const addMessages = useCallback(
    async (add: MessageType[]) => {
      const promises = add.map((m) => convertMessage(m))
      const converted = await Promise.all(promises)
      const allIds = [...messages.messagesAllIds]
      const addMessagesById: MessageById = {}
      const addVoteAnswersById: VoteAnswersById = {}

      for (const { message, vote } of converted) {
        const id = message.id
        if (!allIds.includes(id)) {
          allIds.push(id)
          addMessagesById[id] = { ...message }
        }
        if (message.vote) {
          addVoteAnswersById[id] = vote
        }
      }

      setMessagesById((current) => ({
        ...current,
        ...addMessagesById
      }))

      setMessages((current) => ({
        ...current,
        messagesAllIds: allIds
      }))

      setVoteAnswersById((current) => ({
        ...current,
        ...addVoteAnswersById
      }))
    },
    [messages.messagesAllIds, setMessagesById, setMessages, setVoteAnswersById]
  )

  const addMessage = async (message: MessageType) => {
    const converted = await convertMessage(message)

    if ((messages.messagesAllIds as string[]).includes(message.id)) {
      return
    }

    setMessages((current) => {
      const allIds = [...current.messagesAllIds, message.id]
      return {
        ...current,
        messagesAllIds: allIds
      }
    })

    setMessagesById((current) => {
      return {
        ...current,
        [message.id]: converted.message
      }
    })

    setVoteAnswersById((current) => {
      if (!message.vote) {
        return current
      }

      return {
        ...current,
        [message.id]: converted.vote
      }
    })
  }

  const modifyMessage = async (message: MessageType) => {
    const converted = await convertMessage(message)

    setMessagesById((current) => {
      const beforeMessage = current[message.id]
      return {
        ...current,
        [message.id]: {
          ...beforeMessage,
          message: converted.message.message,
          html: converted.message.html
        }
      }
    })
  }

  const removeMessage = async (message: MessageType) => {
    const converted = await convertMessage(message)

    setMessagesById((current) => {
      return {
        ...current,
        [message.id]: {
          ...converted.message,
          message: '',
          html: ''
        }
      }
    })
  }

  const updateIine = (messageId: string, iine: number) => {
    setMessagesById((current) => {
      const message = current[messageId]

      return {
        ...current,
        [messageId]: {
          ...message,
          iine
        }
      }
    })
  }

  const setVoteAnswers = useCallback(
    (messageId: string, answers: VoteAnswerType[]) => {
      // @todo 数秒間queueに詰めて最後の結果だけ入れる
      const message = messagesById[messageId]
      if (!message) {
        return
      }

      setVoteAnswersById((current) => {
        return {
          ...current,
          [messageId]: {
            ...current[messageId],
            answers
          }
        }
      })
    },
    [messagesById, setVoteAnswersById]
  )

  return {
    convertMessage,
    addMessages,
    addMessage,
    modifyMessage,
    removeMessage,
    updateIine,
    setVoteAnswers
  } as const
}
