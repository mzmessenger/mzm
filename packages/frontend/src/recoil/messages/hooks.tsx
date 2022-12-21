import type { MessageType } from 'mzm-shared/type/socket'
import type { useSocketActions } from '../../recoil/socket/hooks'
import { useCallback } from 'react'
import {
  atom,
  useRecoilState,
  selectorFamily,
  useRecoilValue,
  useSetRecoilState
} from 'recoil'
import { convertToHtml } from '../../lib/markdown'

import { TO_CLIENT_CMD, FilterToClientType } from 'mzm-shared/type/socket'

type SocketMessageType = FilterToClientType<
  typeof TO_CLIENT_CMD.MESSAGE_RECEIVE
>['message'] & { html?: string }

export type VoteAnswerType = SocketMessageType['vote']['answers'][number]

type StateVoteType = Omit<SocketMessageType['vote'], 'answers'> & {
  answers: {
    [key: number]: VoteAnswerType[]
  }
}

export type StateMessageType = Omit<SocketMessageType, 'vote'> & {
  vote?: StateVoteType
}

type MessageById = {
  [key: string]: StateMessageType
}

const messagesByIdState = atom<MessageById>({
  key: 'state:messages:messagesByid',
  default: {}
})

const getMessageById = selectorFamily({
  key: 'state:messages:messagesByid:id',
  get:
    (messageId: string) =>
    ({ get }) => {
      const byId = get(messagesByIdState)
      return byId[messageId] ?? null
    }
})

export const useMessageById = (roomId: string) => {
  return useRecoilValue(getMessageById(roomId))
}

type VoteAnswersById = {
  [key: string]: {
    [key: number]: VoteAnswerType[]
  }
}

const voteAnswersByIdState = atom<VoteAnswersById>({
  key: 'state:messages:voteAnswersByid',
  default: {}
})

const getVoteAnswerByIdAndIndex = selectorFamily({
  key: 'state:messages:voteAnswersByid:id',
  get:
    (options: { messageId: string; index: number }) =>
    ({ get }) => {
      const byId = get(voteAnswersByIdState)
      if (!byId[options.messageId]) {
        return []
      }
      return byId[options.messageId][options.index] ?? []
    }
})

export const useVoteAnswerByIdAndIndex = (messageId: string, index: number) => {
  return useRecoilValue(getVoteAnswerByIdAndIndex({ messageId, index }))
}

type MessagesState = {
  messagesAllIds: string[] | readonly []
}

const messagesState = atom<MessagesState>({
  key: 'state:messages',
  default: {
    messagesAllIds: []
  }
})

type UseSocketActions = ReturnType<typeof useSocketActions>

export const useVoteSocket = ({
  sendVoteAnswerSocket,
  removeVoteAnswerSocket
}: {
  sendVoteAnswerSocket: UseSocketActions['sendVoteAnswer']
  removeVoteAnswerSocket: UseSocketActions['removeVoteAnswer']
}) => {
  const setVoteAnswersById = useSetRecoilState(voteAnswersByIdState)

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

export const useMessages = () => {
  const [messagesById, setMessagesById] = useRecoilState(messagesByIdState)
  const setVoteAnswersById = useSetRecoilState(voteAnswersByIdState)
  const [messages, setMessages] = useRecoilState(messagesState)

  const convertVoteAnswerByIndex = (
    answers: MessageType['vote']['answers']
  ): StateVoteType['answers'] => {
    return answers.reduce((byIndex, answer) => {
      byIndex[answer.index] = byIndex[answer.index] ?? []
      byIndex[answer.index].push(answer)
      return byIndex
    }, {} as StateVoteType['answers'])
  }

  const convertMessage = useCallback(
    async (m: MessageType): Promise<StateMessageType> => {
      const message: StateMessageType = {
        id: m.id,
        userId: m.userId,
        icon: m.icon,
        userAccount: m.userAccount,
        message: m.message,
        iine: m.iine,
        updated: m.updated,
        removed: m.removed,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt
      }
      message.html = await convertToHtml(m.message)
      if (m.vote) {
        const answers = convertVoteAnswerByIndex(m.vote.answers)
        message.vote = {
          questions: m.vote.questions,
          answers,
          status: m.vote.status
        }
      }
      return message
    },
    []
  )

  const addMessages = useCallback(
    async (add: MessageType[]) => {
      const promises = add.map((m) => convertMessage(m))
      const converted = await Promise.all(promises)
      const allIds = [...messages.messagesAllIds]
      const addMessagesById: MessageById = {}
      const addVoteAnswersById: VoteAnswersById = {}

      for (const message of converted) {
        const id = message.id
        if (!allIds.includes(id)) {
          allIds.push(id)
          addMessagesById[id] = { ...message }
        }
        if (message.vote) {
          addVoteAnswersById[id] = message.vote.answers
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
    [
      messages.messagesAllIds,
      setMessagesById,
      setMessages,
      setVoteAnswersById,
      convertMessage
    ]
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
        [message.id]: converted
      }
    })

    setVoteAnswersById((current) => {
      if (!message.vote) {
        return current
      }

      return {
        ...current,
        [message.id]: message.vote
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
          message: converted.message,
          html: converted.html
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
          ...converted,
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

      const convertedAnswers = convertVoteAnswerByIndex(answers)

      const vote: StateVoteType = {
        ...messagesById[messageId].vote,
        answers: convertedAnswers
      }

      setMessagesById((current) => ({
        ...current,
        [messageId]: {
          ...current[messageId],
          vote
        }
      }))

      setVoteAnswersById((current) => ({
        ...current,
        [messageId]: vote
      }))
    },
    [messagesById, setMessagesById, setVoteAnswersById]
  )

  return {
    messages,
    convertVoteAnswerByIndex,
    convertMessage,
    addMessages,
    addMessage,
    modifyMessage,
    removeMessage,
    updateIine,
    setVoteAnswers
  } as const
}
