import React, { useMemo } from 'react'
import styled from '@emotion/styled'
import Settings from '@mui/icons-material/Settings'
import { useUi, useDispatchUi } from '../../contexts/ui/hooks'
import { useUser } from '../../contexts/user/hooks'

export const MyInfo = () => {
  const { me } = useUser()
  const { isOpenSettings } = useUi()
  const { closeSettings, openSettings } = useDispatchUi()
  const icon = useMemo(() => {
    return me ? me.iconUrl : null
  }, [me])

  const clickSettings = () => {
    if (isOpenSettings) {
      closeSettings()
    } else {
      openSettings()
    }
  }

  const m = me ? me.account : ''

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
