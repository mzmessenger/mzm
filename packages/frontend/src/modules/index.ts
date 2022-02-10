import { combineReducers, createStore } from 'redux'
import { reducer as roomsReducer } from './rooms'
import { RoomsState } from './rooms.types'
import { reducer as messagesReducer } from './messages'
import { MessagesState } from './messages.type'
import { reducer as uiReducer } from './ui'
import { UIState } from './ui.types'
import { reducer as searchReducer } from './search'
import { SearchState } from './search.types'

export type State = {
  rooms: RoomsState
  messages: MessagesState
  ui: UIState
  search: SearchState
}

export const reducer = combineReducers({
  rooms: roomsReducer,
  messages: messagesReducer,
  ui: uiReducer,
  search: searchReducer
})

export const store = createStore(reducer)
