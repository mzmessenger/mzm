export const VoteAnswerTypeEnum = {
  ok: '○',
  ng: '×',
  na: '△'
} as const

export type VoteAnswer = {
  answer: number
  index: number
  userId: string
  userAccount: string
  icon: string
}

export type Message = {
  id: string
  userId: string
  icon: string
  userAccount: string
  message: string
  iine: number
  html?: string
  updated: boolean
  createdAt: string
  vote?: {
    questions: { text: string }[]
    answers: {
      [key: number]: VoteAnswer[]
    }
    status: 0 | 1
  }
}
