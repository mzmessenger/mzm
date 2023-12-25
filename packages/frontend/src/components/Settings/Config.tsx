import React from 'react'
import styled from '@emotion/styled'
import { useLocalStorage } from '../../lib/hooks/useLocalStorage'
import { ToggleSwitch } from '../atoms/ToggleSwitch'
import { StorageKeys } from '../../lib/logger'

export function Config() {
  const [infoLog, setInfoLog] = useLocalStorage(StorageKeys.info, 'false')

  return (
    <Wrap>
      <div>
        <h3>ログ設定</h3>
        <div className="info-log item">
          <div>infoログ出力</div>
          <div className="switch">
            <ToggleSwitch
              checked={infoLog === 'true'}
              onChange={(c) => {
                c ? setInfoLog('true') : setInfoLog('false')
              }}
            />
          </div>
        </div>
      </div>
    </Wrap>
  )
}

const Wrap = styled.div`
  display: flex;

  h3 {
    margin: 0;
  }

  .item {
    height: 3em;

    .switch {
      margin-left: 1em;
    }
  }

  .info-log {
    margin-top: 1em;
    display: flex;
    justify-content: center;
    align-items: center;
  }
`
