import { combineReducers, createStore } from 'redux'
import { reducer as socketReducer } from './socket'
import { SocketState } from './socket.types'
import { reducer as roomsReducer } from './rooms'
import { RoomsState } from './rooms.types'
import { reducer as messagesReducer } from './messages'
import { MessagesState } from './messages.type'
import { reducer as userReducer } from './user'
import { UserState } from './user.types'
import { reducer as uiReducer } from './ui'
import { UIState } from './ui.types'
import { reducer as searchReducer } from './search'
import { SearchState } from './search.types'

export type State = {
  socket: SocketState
  rooms: RoomsState
  messages: MessagesState
  user: UserState
  ui: UIState
  search: SearchState
}

export const reducer = combineReducers({
  socket: socketReducer,
  rooms: roomsReducer,
  messages: messagesReducer,
  user: userReducer,
  ui: uiReducer,
  search: searchReducer
})

export const store = createStore(reducer)
