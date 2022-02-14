export const DEFAULT_INTERVAL = 1000
export const RECONNECT_DECAY = 1.5
export const MAX_RECONNECT = 10
export const INIT_RECONNECT_INTERVAL = 10

export type State = {
  socket: WebSocket
  reconnectInterval: number
  reconnectAttempts: number
  reconnectTimer: ReturnType<typeof setTimeout>
}

export const INITIAL_STATE: State = {
  socket: null,
  reconnectInterval: 0,
  reconnectAttempts: 0,
  reconnectTimer: null
} as const

export const ACTIONS = {
  INIT: 'SocketAction:Init',
  OPEN: 'SocketAction:Open',
  CLOSE: 'SocketAction:Close'
} as const

export type Action =
  | {
      type: typeof ACTIONS.INIT
      payload: WebSocket
    }
  | { type: typeof ACTIONS.OPEN }
  | {
      type: typeof ACTIONS.CLOSE
      payload: { timer: ReturnType<typeof setTimeout> }
    }
