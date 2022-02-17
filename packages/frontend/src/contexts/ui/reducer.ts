import { State, INITIAL_STATE, ActionType, Actions } from './constants'
import { WIDTH_MOBILE } from '../../lib/constants'

export const reducer = (
  state: State = INITIAL_STATE,
  action: ActionType
): State => {
  switch (action.type) {
    case Actions.Onresize:
      state.device = action.payload.innerWidth <= WIDTH_MOBILE ? 'mobile' : 'pc'
      return { ...state }
    case Actions.OpenMenu:
      return {
        ...state,
        menuStatus: 'open',
        overlay: true,
        isOpenSettings: false
      }
    case Actions.CloseMenu:
      return { ...state, menuStatus: 'close', overlay: false }
    case Actions.OpenSettings:
      return { ...state, isOpenSettings: true, overlay: false }
    case Actions.CloseSettings:
      return { ...state, isOpenSettings: false }
    case Actions.OpenUserDetail:
      return {
        ...state,
        isOpenUserDetail: true,
        userDetail: {
          id: action.payload.id,
          account: action.payload.account,
          icon: action.payload.icon
        }
      }
    case Actions.CloseUserDetail:
      return { ...state, isOpenUserDetail: false, userDetail: null }
  }
  return state
}
