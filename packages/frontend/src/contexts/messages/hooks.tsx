import { useContext, useReducer, useCallback } from 'react'
import type { MessageType } from 'mzm-shared/type/socket'
import type { useDispatchSocket } from '../socket/hooks'
import type { useUser } from '../user/hooks'
import { convertToHtml } from '../../lib/markdown'
import { MessagesContext, MessagesDispatchContext } from './index'
import {
  INITIAL_STATE,
  Actions,
  StateMessageType,
  StateVoteType,
  VoteAnswerType
} from './constants'
import { reducer } from './reducer'

export const useMessages = () => {
  return useContext(MessagesContext)
}

export const useDispatchMessages = () => {
  return useContext(MessagesDispatchContext)
}

export const useMessagesForContext = () => {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

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

  const addMessages = async (messages: MessageType[]) => {
    const promises = messages.map((m) => convertMessage(m))
    const converted = await Promise.all(promises)
    return dispatch({
      type: Actions.AddMessages,
      payload: { messages: converted }
    })
  }

  const addMessage = async (message: MessageType) => {
    const converted = await convertMessage(message)
    return dispatch({
      type: Actions.AddMessage,
      payload: { message: converted }
    })
  }

  const modifyMessage = async (message: MessageType) => {
    const converted = await convertMessage(message)
    return dispatch({
      type: Actions.ModifyMessageSuccess,
      payload: {
        message: converted
      }
    })
  }

  const removeMessage = async (message: MessageType) => {
    const converted = await convertMessage(message)
    return dispatch({
      type: Actions.RemoveMessage,
      payload: {
        message: converted
      }
    })
  }

  const updateIine = (messageId: string, iine: number) => {
    dispatch({
      type: Actions.UpdateIine,
      payload: {
        message: messageId,
        iine
      }
    })
  }

  const setVoteAnswers = (messageId: string, answers: VoteAnswerType[]) => {
    // @todo ?????????queue??????????????????????????????????????????
    dispatch({
      type: Actions.SetVoteAnswers,
      payload: {
        messageId,
        answers: convertVoteAnswerByIndex(answers)
      }
    })
  }

  const sendVoteAnswer = (
    messageId: string,
    index: number,
    answer: number,
    me: ReturnType<typeof useUser>['me'],
    sendVoteAnswer: ReturnType<typeof useDispatchSocket>['sendVoteAnswer']
  ) => {
    dispatch({
      type: Actions.SendVoteAnswer,
      payload: {
        messageId: messageId,
        userId: me.id,
        vote: {
          userId: me.id,
          userAccount: me.account,
          icon: me.iconUrl,
          index: index,
          answer: answer
        }
      }
    })
    sendVoteAnswer(messageId, index, answer)
  }

  const removeVoteAnswer = (
    messageId: string,
    index: number,
    me: ReturnType<typeof useUser>['me'],
    removeVoteAnswer: ReturnType<typeof useDispatchSocket>['removeVoteAnswer']
  ) => {
    dispatch({
      type: Actions.RemoveVoteAnswer,
      payload: {
        messageId: messageId,
        userId: me.id,
        index: index
      }
    })
    removeVoteAnswer(messageId, index)
  }

  return {
    state,
    convertVoteAnswerByIndex: useCallback(convertVoteAnswerByIndex, []),
    convertMessage: convertMessage,
    addMessages: useCallback(addMessages, [convertMessage]),
    addMessage: useCallback(addMessage, [convertMessage]),
    modifyMessage: useCallback(modifyMessage, [convertMessage]),
    removeMessage: useCallback(removeMessage, []),
    updateIine: useCallback(updateIine, []),
    setVoteAnswers: useCallback(setVoteAnswers, []),
    sendVoteAnswer: useCallback(sendVoteAnswer, []),
    removeVoteAnswer: useCallback(removeVoteAnswer, [])
  } as const
}
