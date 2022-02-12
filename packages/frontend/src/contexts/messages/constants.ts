import { TO_CLIENT_CMD, FilterToClientType } from 'mzm-shared/type/socket'

type SocketMessageType = FilterToClientType<
  typeof TO_CLIENT_CMD.MESSAGE_RECEIVE
>['message'] & { html?: string }

export type VoteAnswerType = SocketMessageType['vote']['answers'][number]

export type StateVoteType = Omit<SocketMessageType['vote'], 'answers'> & {
  answers: {
    [key: number]: VoteAnswerType[]
  }
}

export type StateMessageType = Omit<SocketMessageType, 'vote'> & {
  vote?: StateVoteType
}

export type State = {
  messages: {
    byId: {
      [key: string]: StateMessageType
    }
    allIds: string[] | readonly []
  }
  voteAnswers: {
    byId: {
      [key: string]: {
        [key: number]: VoteAnswerType[]
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
      payload: { messages: StateMessageType[] }
    }
  | {
      type: typeof Actions.AddMessage
      payload: { message: StateMessageType }
    }
  | {
      type: typeof Actions.ModifyMessageSuccess
      payload: { message: StateMessageType }
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
          [key: number]: VoteAnswerType[]
        }
      }
    }
  | {
      type: typeof Actions.SendVoteAnswer
      payload: {
        messageId: string
        userId: string
        vote: VoteAnswerType
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
