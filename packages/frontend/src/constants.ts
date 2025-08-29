declare global {
  var __API_URL_BASE__: string
  var __AUTH_URL_BASE__: string
}

export const API_URL_BASE = __API_URL_BASE__
export const AUTH_URL_BASE = __AUTH_URL_BASE__

export const REDIRECT_URI = `${location.origin}/login/success`

export const WIDTH_MOBILE = 720

export type EmojisKey = `:${string}:`
export type EmojisValue = {
  value: string
  type: 'unicode'
}

export const emojis = new Map<EmojisKey, EmojisValue>([
  [':smile:', { type: 'unicode', value: '😊' }],
  [':thinking:', { type: 'unicode', value: '🤔' }],
  [':innocent:', { type: 'unicode', value: '😇' }],
  [':cry:', { type: 'unicode', value: '😢' }],
  [':+1:', { type: 'unicode', value: '👍' }],
  [':eyes:', { type: 'unicode', value: '👀' }],
  [':heart:', { type: 'unicode', value: '❤️' }]
])
