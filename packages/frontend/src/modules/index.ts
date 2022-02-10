import { combineReducers, createStore } from 'redux'
import { reducer as roomsReducer } from './rooms'
import { RoomsState } from './rooms.types'
import { reducer as messagesReducer } from './messages'
import { MessagesState } from './messages.type'

export type State = {
  rooms: RoomsState
  messages: MessagesState
}

export const reducer = combineReducers({
  rooms: roomsReducer,
  messages: messagesReducer
})

export const store = createStore(reducer)
