/// <reference types="node" />

export const API_URL_BASE = process.env.API_URL_BASE ?? ''

export const SOCKET_URL = process.env.SOCKET_URL ?? ''
export const AUTH_URL_BASE = process.env.AUTH_URL_BASE ?? ''

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
