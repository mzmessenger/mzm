import React, { useState } from 'react'
import styled from '@emotion/styled'
import CancelIcon from '@mui/icons-material/Cancel'
import { WIDTH_MOBILE, AUTH_URL_BASE } from '../../constants'
import { useUiActions } from '../../state/ui/hooks'
import { SettingUser } from './SettingUser'
import { Config } from './Config'

const menu = ['default', 'setting']

const Settings = () => {
  const [selectedMenu, setSelectedMenu] = useState(menu[0])
  const { closeSettings } = useUiActions()
  const onClose = () => {
    closeSettings()
  }

  return (
    <Wrap>
      <div className="inner">
        <header>
          <h2>設定</h2>
          <div className="setting-close">
            <CancelIcon className="icon" onClick={onClose} />
          </div>
        </header>
        <div className="user">
          <ul className="menu">
            <li
              className={selectedMenu === menu[0] ? 'active' : ''}
              onClick={() => setSelectedMenu(menu[0])}
            >
              アカウント
            </li>
            <li
              className={selectedMenu === menu[1] ? 'active' : ''}
              onClick={() => setSelectedMenu(menu[1])}
            >
              設定
            </li>
            <div className="divider"></div>
            <li className="logout">
              <a
                href={`${AUTH_URL_BASE}/auth/logout?redirect_uri=${location.origin}`}
              >
                ログアウト
              </a>
            </li>
          </ul>
          <div className="body">
            {selectedMenu === menu[0] && <SettingUser />}
            {selectedMenu === menu[1] && <Config />}
          </div>
        </div>
      </div>
    </Wrap>
  )
}
export default Settings

const Wrap = styled.div`
  flex: 1;
  padding: 8px 32px;
  color: var(--color-on-background);
  font-size: 1em;
  container-name: user-setting-container;
  container-type: inline-size;

  .inner > header {
    padding: 0 8px;
    display: flex;
    h2 {
      flex: 1;
    }
  }

  .inner {
    background: var(--color-surface);
    color: var(--color-on-surface);
    padding: 8px 16px;
  }

  .user {
    border-top: 1px solid var(--color-border);
    display: flex;
  }

  .menu {
    margin: 0;
    padding: 1em 0.5em 1em 0;
    list-style-type: none;
    cursor: pointer;
    border-right: 1px solid var(--color-border);
    min-width: 5em;
    > li {
      padding: 0.5em 0.5em;
      min-width: 192px;
    }
    .active {
      background: var(--color-surface);
    }
    .divider {
      border-top: 1px solid var(--color-border);
      margin: 1em 0;
    }
  }

  .body {
    padding: 2em 16px 2em;
    flex: 1;
  }

  .logout {
    display: flex;
    color: var(--color-warning);
    a {
      flex: 1;
    }
  }

  .setting-close {
    margin-top: 16px;
    .icon {
      width: 32px;
      cursor: pointer;
    }
  }

  @container user-setting-container (max-width: ${WIDTH_MOBILE}px) {
    padding-left: 0;
    padding-right: 0;

    .user {
      flex-direction: column;

      .menu {
        border-right: none;
        border-bottom: 1px solid var(--color-border);
        display: flex;
        > li {
          padding-left: 1em;
          &:first-of-type {
            padding-left: 0;
          }
        }
      }

      .body {
        padding: 0;
      }
    }
  }
`
