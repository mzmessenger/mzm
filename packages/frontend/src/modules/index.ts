import { combineReducers, createStore } from 'redux'
import { reducer as roomsReducer } from './rooms'
import { RoomsState } from './rooms.types'

export type State = {
  rooms: RoomsState
}

export const reducer = combineReducers({
  rooms: roomsReducer
})

export const store = createStore(reducer)
