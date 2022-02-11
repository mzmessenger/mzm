import { useContext, useReducer, useCallback } from 'react'
import { PostTextAreaContext, PostTextAreaDispatchContext } from './index'
import { reducer } from './reducer'
import { INITIAL_STATE, Actions } from './constants'

export const usePostTextArea = () => {
  return useContext(PostTextAreaContext)
}

export const useDispatchPostTextArea = () => {
  return useContext(PostTextAreaDispatchContext)
}

export const usePostTextAreaForContext = () => {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const startToEdit = (messageId: string, txt: string) => {
    dispatch({ type: Actions.StartEditing, payload: { id: messageId, txt } })
  }

  const endToEdit = () => {
    dispatch({ type: Actions.EndEditing })
  }

  const modifyMessage = (txt: string) => {
    dispatch({ type: Actions.ModifyText, payload: { txt } })
  }

  const inputMessage = (txt: string) => {
    dispatch({ type: Actions.InputText, payload: { txt } })
  }

  return {
    state,
    startToEdit: useCallback(startToEdit, []),
    endToEdit: useCallback(endToEdit, []),
    modifyMessage: useCallback(modifyMessage, []),
    inputMessage: useCallback(inputMessage, [])
  } as const
}
