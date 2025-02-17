export type Room = {
  id: string
  name: string
  iconUrl: string
  description: string
  unread: number
  replied: number
  messages: string[]
  loading: boolean
  receivedMessages: boolean
  existHistory: boolean
  status: 'open' | 'close'
}
