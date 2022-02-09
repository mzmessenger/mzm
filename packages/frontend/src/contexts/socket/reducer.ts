import {
  State,
  INITIAL_STATE,
  Action,
  ACTIONS,
  DEFAULT_INTERVAL,
  RECONNECT_DECAY
} from './constants'

export const reducer = (
  state: State = INITIAL_STATE,
  action: Action
): State => {
  switch (action.type) {
    case ACTIONS.INIT: {
      const socket = action.payload
      return { ...state, socket: socket }
    }
    case ACTIONS.OPEN: {
      if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer)
      }
      return {
        ...state,
        reconnectInterval: 0,
        reconnectAttempts: 0,
        reconnectTimer: null
      }
    }
    case ACTIONS.CLOSE: {
      const reconnectInterval =
        state.reconnectInterval <= 0
          ? DEFAULT_INTERVAL
          : state.reconnectInterval *
            Math.floor(Math.pow(RECONNECT_DECAY, state.reconnectAttempts))

      return {
        ...state,
        reconnectInterval,
        reconnectAttempts: state.reconnectAttempts + 1,
        reconnectTimer: action.payload.timer
      }
    }
    default:
      return state
  }
}
