import {
  State,
  INITIAL_STATE,
  ActionType,
  Actions,
  VoteAnswerType
} from './constants'

const updateVoteAnswers = (
  state: State,
  messageId: string,
  index: number,
  answers: VoteAnswerType[]
): State['voteAnswers'] => {
  return {
    ...state.voteAnswers,
    byId: {
      ...state.voteAnswers.byId,
      [messageId]: {
        ...state.voteAnswers.byId[messageId],
        [index]: answers
      }
    }
  }
}

export const reducer = (
  state: State = INITIAL_STATE,
  action: ActionType
): State => {
  switch (action.type) {
    case Actions.AddMessages: {
      const allIds = [...state.messages.allIds]
      for (const message of action.payload.messages) {
        const id = message.id
        if (!allIds.includes(id)) {
          allIds.push(id)
          const m = { ...message }
          state.messages.byId[id] = m
        }
        if (message.vote) {
          state.voteAnswers.byId[id] = message.vote.answers
        }
      }
      state.messages.allIds = allIds
      return { ...state }
    }
    case Actions.AddMessage: {
      const allIds = [...state.messages.allIds, action.payload.message.id]
      state.messages.byId[action.payload.message.id] = {
        ...action.payload.message
      }
      if (action.payload.message.vote) {
        state.voteAnswers.byId[action.payload.message.id] =
          action.payload.message.vote
      }
      state.messages.allIds = [...allIds]
      return { ...state }
    }
    case Actions.ModifyMessageSuccess: {
      const message = state.messages.byId[action.payload.message.id]
      state.messages.byId[action.payload.message.id] = {
        ...message,
        message: action.payload.message.message,
        html: action.payload.message.html
      }
      return { ...state }
    }
    case Actions.UpdateIine: {
      const message = state.messages.byId[action.payload.message]
      state.messages.byId[action.payload.message] = {
        ...message,
        iine: action.payload.iine
      }

      return state
    }
    case Actions.SetVoteAnswers: {
      state.voteAnswers = {
        ...state.voteAnswers,
        byId: {
          ...state.voteAnswers.byId,
          [action.payload.messageId]: action.payload.answers
        }
      }

      state.messages.byId[action.payload.messageId].vote = {
        ...state.messages.byId[action.payload.messageId].vote,
        answers: action.payload.answers
      }
      return { ...state }
    }
    case Actions.SendVoteAnswer: {
      const answers = (
        state.voteAnswers.byId[action.payload.messageId][
          action.payload.vote.index
        ] ?? []
      ).filter((e) => {
        return e.userId !== action.payload.userId
      })
      answers.push(action.payload.vote)
      state.voteAnswers.byId[action.payload.messageId][
        action.payload.vote.index
      ] = answers

      state.voteAnswers = updateVoteAnswers(
        state,
        action.payload.messageId,
        action.payload.vote.index,
        answers
      )
      return { ...state }
    }
    case Actions.RemoveVoteAnswer: {
      const answers = state.voteAnswers.byId[action.payload.messageId][
        action.payload.index
      ].filter((e) => e.userId !== action.payload.userId)

      state.voteAnswers = updateVoteAnswers(
        state,
        action.payload.messageId,
        action.payload.index,
        answers
      )

      return { ...state }
    }
  }
  return state
}
