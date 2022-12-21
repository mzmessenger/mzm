import { useCallback } from 'react'
import { atom, useSetRecoilState, selector, useRecoilValue } from 'recoil'

const WIDTH_MOBILE = 720

type UiState = {
  device: 'pc' | 'mobile'
  menuStatus: 'open' | 'close'
  overlay: boolean
  isOpenSettings: boolean
  isOpenUserDetail: boolean
  userDetail: { id: string; account: string; icon: string }
}

const uiState = atom<UiState>({
  key: 'state:ui',
  default: {
    device: 'pc',
    menuStatus: 'close',
    overlay: false,
    isOpenSettings: false,
    isOpenUserDetail: false,
    userDetail: null
  }
})

const menuUiState = selector({
  key: 'state:ui:selector:menu',
  get: ({ get }) => {
    const { menuStatus, overlay, device } = get(uiState)
    return {
      menuStatus,
      overlay,
      device
    }
  }
})

export const useMenuUi = () => useRecoilValue(menuUiState)

const settingsUiState = selector({
  key: 'state:ui:selector:settings',
  get: ({ get }) => {
    const { isOpenSettings } = get(uiState)
    return { isOpenSettings }
  }
})

export const useSettingsUi = () => useRecoilValue(settingsUiState)

const userDetailUiState = selector({
  key: 'state:ui:selector:userDetail',
  get: ({ get }) => {
    const { userDetail, isOpenUserDetail } = get(uiState)
    return { userDetail, isOpenUserDetail }
  }
})

export const useUserDetailUi = () => useRecoilValue(userDetailUiState)

export const useUiActions = () => {
  const setUiState = useSetRecoilState(uiState)

  const onResize = useCallback(
    (innerWidth: number, innerHeight: number) => {
      const device = innerWidth <= WIDTH_MOBILE ? 'mobile' : 'pc'
      setUiState((current) => {
        return { ...current, device }
      })
    },
    [setUiState]
  )

  const openMenu = useCallback(() => {
    setUiState((current) => {
      return {
        ...current,
        menuStatus: 'open',
        overlay: true,
        isOpenSettings: false
      }
    })
  }, [setUiState])

  const closeMenu = useCallback(() => {
    setUiState((current) => {
      return {
        ...current,
        menuStatus: 'close',
        overlay: false
      }
    })
  }, [setUiState])

  const openSettings = useCallback(() => {
    setUiState((current) => {
      return {
        ...current,
        isOpenSettings: true,
        overlay: false
      }
    })
  }, [setUiState])

  const closeSettings = useCallback(() => {
    setUiState((current) => {
      return {
        ...current,
        isOpenSettings: false
      }
    })
  }, [setUiState])

  const toggleSettings = useCallback(() => {
    setUiState((current) => {
      return {
        ...current,
        isOpenSettings: !current.isOpenSettings,
        overlay: false
      }
    })
  }, [setUiState])

  const openUserDetail = useCallback(
    (id: string, account: string, icon: string) => {
      setUiState((current) => {
        return {
          ...current,
          isOpenUserDetail: true,
          userDetail: {
            id: id,
            account: account,
            icon: icon
          }
        }
      })
    },
    [setUiState]
  )

  const closeUserDetail = useCallback(() => {
    setUiState((current) => {
      return {
        ...current,
        isOpenUserDetail: false,
        userDetail: null
      }
    })
  }, [setUiState])

  return {
    openMenu,
    closeMenu,
    onResize,
    openSettings,
    closeSettings,
    toggleSettings,
    openUserDetail,
    closeUserDetail
  } as const
}
