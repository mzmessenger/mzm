import { useContext, useReducer, useCallback } from 'react'
import type { useDispatchSocket } from '../socket/hooks'
import type { useUser } from '../user/hooks'
import { ReceiveMessage, Message, VoteAnswer } from '../../type'
import { convertToHtml } from '../../lib/markdown'
import { MessagesContext, MessagesDispatchContext } from './index'
import { INITIAL_STATE, Actions } from './constants'
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
    answers: ReceiveMessage['vote']['answers']
  ): { [key: number]: VoteAnswer[] } => {
    return answers.reduce((byIndex, answer) => {
      byIndex[answer.index] = byIndex[answer.index] ?? []
      byIndex[answer.index].push(answer)
      return byIndex
    }, {})
  }

  const convertMessage = async (m: ReceiveMessage): Promise<Message> => {
    const message: Message = {
      id: m.id,
      userId: m.userId,
      icon: m.icon,
      userAccount: m.userAccount,
      message: m.message,
      iine: m.iine,
      updated: m.updated,
      createdAt: m.createdAt
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
  }

  const addMessages = async (messages: ReceiveMessage[]) => {
    const promises = messages.map((m) => convertMessage(m))
    const converted = await Promise.all(promises)
    return dispatch({
      type: Actions.AddMessages,
      payload: { messages: converted }
    })
  }

  const addMessage = async (message: ReceiveMessage) => {
    const converted = await convertMessage(message)
    return dispatch({
      type: Actions.AddMessage,
      payload: { message: converted }
    })
  }

  const modifyMessage = async (message: ReceiveMessage) => {
    const converted = await convertMessage(message)
    return dispatch({
      type: Actions.ModifyMessageSuccess,
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

  const setVoteAnswers = (messageId: string, answers: VoteAnswer[]) => {
    // @todo 数秒間queueに詰めて最後の結果だけ入れる
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
    convertMessage: useCallback(convertMessage, []),
    addMessages: useCallback(addMessages, []),
    addMessage: useCallback(addMessage, []),
    modifyMessage: useCallback(modifyMessage, []),
    updateIine: useCallback(updateIine, []),
    setVoteAnswers: useCallback(setVoteAnswers, []),
    sendVoteAnswer: useCallback(sendVoteAnswer, []),
    removeVoteAnswer: useCallback(removeVoteAnswer, [])
  } as const
}
