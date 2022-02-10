import { State, INITIAL_STATE, ActionType, Actions } from './constants'

export const reducer = (
  state: State = INITIAL_STATE,
  action: ActionType
): State => {
  switch (action.type) {
    case Actions.AddMessages: {
      const allIds = [...state.messages.allIds]
      for (const message of action.payload.messages) {
        if (!allIds.includes(message.id)) {
          allIds.push(message.id)
          const m = { ...message }
          state.messages.byId[message.id] = m
        }
        if (message.vote) {
          state.voteAnswers.byId[message.id] = message.vote.answers
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
          action.payload.message.vote.answers
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
      state.voteAnswers.byId[action.payload.messageId] = action.payload.answers
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
      return state
    }
    case Actions.RemoveVoteAnswer: {
      const answers = state.voteAnswers.byId[action.payload.messageId][
        action.payload.index
      ].filter((e) => e.userId !== action.payload.userId)
      state.voteAnswers.byId[action.payload.messageId][action.payload.index] = [
        ...answers
      ]
      return state
    }
  }
  return state
}
