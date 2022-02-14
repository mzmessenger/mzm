export type State = {
  device: 'pc' | 'mobile'
  menuStatus: 'open' | 'close'
  overlay: boolean
  isOpenSettings: boolean
  isOpenUserDetail: boolean
  userDetail: { id: string; account: string; icon: string }
}

export const INITIAL_STATE: State = {
  device: 'pc',
  menuStatus: 'close',
  overlay: false,
  isOpenSettings: false,
  isOpenUserDetail: false,
  userDetail: null
} as const

export const Actions = {
  Onresize: 'UIAction:Onresize',
  OpenMenu: 'UIAction:OpenMenu',
  CloseMenu: 'UIAction:CloseMenu',
  OpenSettings: 'UIAction:OpenSettings',
  CloseSettings: 'UIAction:CloseSettings',
  OpenUserDetail: 'UIAction:OpenUserDetail',
  CloseUserDetail: 'UIAction:CloseUserDetail'
} as const

export type ActionType =
  | {
      type: typeof Actions.Onresize
      payload: { innerHeight: number; innerWidth: number }
    }
  | {
      type: typeof Actions.OpenMenu
    }
  | {
      type: typeof Actions.CloseMenu
    }
  | {
      type: typeof Actions.OpenSettings
    }
  | {
      type: typeof Actions.CloseSettings
    }
  | {
      type: typeof Actions.OpenUserDetail
      payload: { id: string; account: string; icon: string }
    }
  | {
      type: typeof Actions.CloseUserDetail
    }
