import { combineReducers, createStore } from 'redux'
import { reducer as roomsReducer } from './rooms'
import { RoomsState } from './rooms.types'
import { reducer as messagesReducer } from './messages'
import { MessagesState } from './messages.type'
import { reducer as uiReducer } from './ui'
import { UIState } from './ui.types'

export type State = {
  rooms: RoomsState
  messages: MessagesState
  ui: UIState
}

export const reducer = combineReducers({
  rooms: roomsReducer,
  messages: messagesReducer,
  ui: uiReducer
})

export const store = createStore(reducer)
