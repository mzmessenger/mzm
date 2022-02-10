export type State = {
  inputMode: 'normal' | 'edit'
  txt: string
  editTxt: string
  editId: string
}

export const INITIAL_STATE: State = {
  inputMode: 'normal',
  txt: '',
  editTxt: '',
  editId: null
} as const

export const Actions = {
  InputText: 'UIAction:InputText',
  StartEditing: 'UIAction:StartEditing',
  EndEditing: 'UIAction:EndEditing',
  ModifyText: 'UIAction:ModifyText'
} as const

export type ActionType =
  | {
      type: typeof Actions.InputText
      payload: { txt: string }
    }
  | {
      type: typeof Actions.StartEditing
      payload: { id: string; txt: string }
    }
  | {
      type: typeof Actions.EndEditing
    }
  | {
      type: typeof Actions.ModifyText
      payload: { txt: string }
    }