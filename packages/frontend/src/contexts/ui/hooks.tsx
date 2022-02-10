import { useContext, useReducer } from 'react'
import { UiContext, UiDispatchContext } from './index'
import { reducer } from './reducer'
import { INITIAL_STATE, Actions } from './constants'

export const useUi = () => {
  return useContext(UiContext)
}

export const useDispatchUi = () => {
  return useContext(UiDispatchContext)
}

export const useUiForContext = () => {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const onResize = (innerWidth: number, innerHeight: number) => {
    dispatch({ type: Actions.Onresize, payload: { innerWidth, innerHeight } })
  }

  const openMenu = () => {
    dispatch({ type: Actions.OpenMenu })
  }

  const closeMenu = () => {
    dispatch({ type: Actions.CloseMenu })
  }

  const openSettings = () => {
    dispatch({ type: Actions.OpenSettings })
  }

  const closeSettings = () => {
    dispatch({ type: Actions.CloseSettings })
  }

  const openUserDetail = (id: string, account: string, icon: string) => {
    dispatch({ type: Actions.OpenUserDetail, payload: { id, account, icon } })
  }

  const closeUserDetail = () => {
    dispatch({ type: Actions.CloseUserDetail })
  }

  return {
    state,
    onResize,
    openMenu,
    closeMenu,
    openSettings,
    closeSettings,
    openUserDetail,
    closeUserDetail
  } as const
}
