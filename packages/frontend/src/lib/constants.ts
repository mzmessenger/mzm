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
