import { Message, VoteAnswer } from '../../type'

export type State = {
  messages: {
    byId: {
      [key: string]: Message
    }
    allIds: string[] | readonly []
  }
  voteAnswers: {
    byId: {
      [key: string]: {
        [key: number]: VoteAnswer[]
      }
    }
  }
}

export const INITIAL_STATE: State = {
  messages: {
    byId: {},
    allIds: []
  },
  voteAnswers: {
    byId: {}
  }
} as const

export const Actions = {
  AddMessages: 'messageAction:addMessages',
  AddMessage: 'messageAction:addMessage',
  ModifyMessageSuccess: 'messageAction:modifyMessageSuccess',
  UpdateIine: 'messageAction:updateIine',
  SetVoteAnswers: 'messageAction:setVoteAnswers',
  SendVoteAnswer: 'messageAction:sendVoteAnswer',
  RemoveVoteAnswer: 'messageAction:removeVoteAnswer'
} as const

export type ActionType =
  | {
      type: typeof Actions.AddMessages
      payload: { messages: Message[] }
    }
  | {
      type: typeof Actions.AddMessage
      payload: { message: Message }
    }
  | {
      type: typeof Actions.ModifyMessageSuccess
      payload: { message: Message }
    }
  | {
      type: typeof Actions.UpdateIine
      payload: {
        message: string
        iine: number
      }
    }
  | {
      type: typeof Actions.SetVoteAnswers
      payload: {
        messageId: string
        answers: {
          [key: number]: VoteAnswer[]
        }
      }
    }
  | {
      type: typeof Actions.SendVoteAnswer
      payload: {
        messageId: string
        userId: string
        vote: VoteAnswer
      }
    }
  | {
      type: typeof Actions.RemoveVoteAnswer
      payload: {
        messageId: string
        userId: string
        index: number
      }
    }
