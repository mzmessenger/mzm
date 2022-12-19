import React from 'react'
import styled from '@emotion/styled'
import Settings from '@mui/icons-material/Settings'
import { useUi, useSettingsUiState } from '../../recoil/ui/hooks'
import { useUserIdAndAccountState } from '../../recoil/user/hooks'

export const MyInfo = () => {
  const { userAccount, userIconUrl } = useUserIdAndAccountState()
  const { closeSettings, openSettings } = useUi()
  const { isOpenSettings } = useSettingsUiState()
  const icon = userIconUrl ? userIconUrl : null

  const clickSettings = () => {
    if (isOpenSettings) {
      closeSettings()
    } else {
      openSettings()
    }
  }

  const m = userAccount ? userAccount : ''

  return (
    <Wrap>
      <div className="profile-wrap">
        {icon && <img className="icon-img" src={icon} width="20" height="20" />}
        <div className="profile">{m}</div>
        <Settings className="settings-icon" onClick={clickSettings} />
      </div>
    </Wrap>
  )
}

const Wrap = styled.div`
  padding: 8px 0;
  .profile-wrap {
    display: flex;
  }
  .icon-img {
    margin: 0 10px 0 0;
    width: 25px;
    height: 25px;
    border-radius: 2px;
  }
  .profile {
    margin: 0 8px 0 0;
    font-size: 18px;
    line-height: 25px;
  }
  .more-ver-icon {
    cursor: pointer;
  }
  .settings-icon {
    cursor: pointer;
  }
`
