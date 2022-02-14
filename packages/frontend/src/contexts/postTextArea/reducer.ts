import { State, INITIAL_STATE, ActionType, Actions } from './constants'

export const reducer = (
  state: State = INITIAL_STATE,
  action: ActionType
): State => {
  switch (action.type) {
    case Actions.InputText:
      return { ...state, txt: action.payload.txt }
    case Actions.StartEditing:
      return {
        ...state,
        inputMode: 'edit',
        editTxt: action.payload.txt,
        editId: action.payload.id
      }
    case Actions.EndEditing:
      return { ...state, inputMode: 'normal', editTxt: '', editId: null }
    case Actions.ModifyText:
      return { ...state, editTxt: action.payload.txt }
  }
  return state
}
