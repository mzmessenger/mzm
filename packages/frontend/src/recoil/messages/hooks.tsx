import type { MessageType } from 'mzm-shared/type/socket'
import type { useSocketActions } from '../../recoil/socket/hooks'
import { useCallback } from 'react'
import { atom, useRecoilState } from 'recoil'
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

type MessagesState = {
  messagesById: {
    [key: string]: StateMessageType
  }
  messagesAllIds: string[] | readonly []
  voteAnswersById: {
    [key: string]: {
      [key: number]: VoteAnswerType[]
    }
  }
}

const messagesState = atom<MessagesState>({
  key: 'state:messages',
  default: {
    messagesById: {},
    messagesAllIds: [],
    voteAnswersById: {}
  }
})

export const useMessages = () => {
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

      setMessages((current) => {
        const allIds = [...current.messagesAllIds]
        const messagesById = { ...current.messagesById }
        const voteAnswersById = { ...current.voteAnswersById }
        for (const message of converted) {
          const id = message.id
          if (!allIds.includes(id)) {
            allIds.push(id)
            messagesById[id] = { ...message }
          }
          if (message.vote) {
            voteAnswersById[id] = message.vote.answers
          }
        }
        return {
          ...current,
          messagesAllIds: allIds,
          messagesById,
          voteAnswersById
        }
      })
    },
    [convertMessage, setMessages]
  )

  const addMessage = async (message: MessageType) => {
    const converted = await convertMessage(message)

    setMessages((current) => {
      if ((current.messagesAllIds as string[]).includes(message.id)) {
        return current
      }
      const allIds = [...current.messagesAllIds, message.id]
      const messagesById = {
        ...current.messagesById,
        [message.id]: converted
      }

      const voteAnswersById = message.vote
        ? {
            ...current.voteAnswersById,
            [message.id]: message.vote
          }
        : current.voteAnswersById

      return {
        ...current,
        messagesAllIds: allIds,
        messagesById,
        voteAnswersById
      }
    })
  }

  const modifyMessage = async (message: MessageType) => {
    const converted = await convertMessage(message)

    setMessages((current) => {
      const beforeMessage = current.messagesById[message.id]
      const messagesById = {
        ...current.messagesById,
        [message.id]: {
          ...beforeMessage,
          message: converted.message,
          html: converted.html
        }
      }
      return {
        ...current,
        messagesById
      }
    })
  }

  const removeMessage = async (message: MessageType) => {
    const converted = await convertMessage(message)

    setMessages((current) => {
      const messagesById = {
        ...current.messagesById,
        [message.id]: {
          ...converted,
          message: '',
          html: ''
        }
      }
      return { ...current, messagesById }
    })
  }

  const updateIine = (messageId: string, iine: number) => {
    setMessages((current) => {
      const message = current.messagesById[messageId]
      const messagesById = {
        ...current.messagesById,
        [messageId]: {
          ...message,
          iine
        }
      }

      return { ...current, messagesById }
    })
  }

  const setVoteAnswers = useCallback(
    (messageId: string, answers: VoteAnswerType[]) => {
      // @todo 数秒間queueに詰めて最後の結果だけ入れる

      setMessages((current) => {
        const convertedAnswers = convertVoteAnswerByIndex(answers)

        const voteAnswersById = {
          ...current.voteAnswersById,
          [messageId]: convertedAnswers
        }

        const vote = {
          ...current.messagesById[messageId].vote,
          answers: convertedAnswers
        }

        const message = {
          ...current.messagesById[messageId],
          vote
        }

        const messagesById: MessagesState['messagesById'] = {
          ...current.messagesById,
          [messageId]: message
        }
        return { ...current, voteAnswersById, messagesById }
      })
    },
    [setMessages]
  )

  const createVoteAnswers = (
    state: MessagesState,
    messageId: string,
    index: number,
    answers: VoteAnswerType[]
  ): MessagesState['voteAnswersById'] => {
    return {
      ...state.voteAnswersById,
      [messageId]: {
        ...state.voteAnswersById[messageId],
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
    },
    sendVoteAnswer: ReturnType<typeof useSocketActions>['sendVoteAnswer']
  ) => {
    setMessages((current) => {
      const answers = (current.voteAnswersById[messageId][index] ?? []).filter(
        (e) => {
          return e.userId !== user.userId
        }
      )

      answers.push({
        userId: user.userId,
        userAccount: user.userAccount,
        icon: user.userIconUrl,
        index: index,
        answer: answer
      })

      const voteAnswersById = createVoteAnswers(
        current,
        messageId,
        index,
        answers
      )
      return { ...current, voteAnswersById }
    })

    sendVoteAnswer(messageId, index, answer)
  }

  const removeVoteAnswer = (
    messageId: string,
    index: number,
    userId: string,
    removeVoteAnswer: ReturnType<typeof useSocketActions>['removeVoteAnswer']
  ) => {
    setMessages((current) => {
      const answers = current.voteAnswersById[messageId][index].filter(
        (e) => e.userId !== userId
      )

      const voteAnswersById = createVoteAnswers(
        current,
        messageId,
        index,
        answers
      )
      return { ...current, voteAnswersById }
    })

    removeVoteAnswer(messageId, index)
  }

  return {
    messages,
    convertVoteAnswerByIndex,
    convertMessage,
    addMessages,
    addMessage,
    modifyMessage,
    removeMessage,
    updateIine,
    setVoteAnswers,
    sendVoteAnswer,
    removeVoteAnswer
  } as const
}
