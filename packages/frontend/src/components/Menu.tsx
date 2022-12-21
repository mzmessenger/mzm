import React, { type PropsWithChildren, type FC, type ReactNode } from 'react'
import styled from '@emotion/styled'
import Settings from '@mui/icons-material/Settings'
import { WIDTH_MOBILE } from '../lib/constants'
import { useNumberLocalStorage } from '../lib/hooks/useLocalStorage'
import { useMenuUi, useUiActions } from '../recoil/ui/hooks'
import { ResizerX } from './atoms/ResizerX'
import { MobileMenuIcon } from './atoms/MobileMenuIcon'
import { RoomNavi } from './RoomNavi'
import { SearchInput } from './Search'
export { Rooms } from './Rooms'

const WIDTH_KEY = 'mzm:menu:width'
const MIN_WIDTH = 240

type Props = {
  rooms: ReactNode
}

export const Menu: FC<PropsWithChildren<Props>> = ({ rooms }) => {
  const { menuStatus, device } = useMenuUi()
  const { openSettings, closeMenu } = useUiActions()
  const className = menuStatus === 'open' ? 'menu open' : 'menu'
  const [width, _setWidth] = useNumberLocalStorage(WIDTH_KEY, MIN_WIDTH)

  const setWidth = (w: number) => {
    if (w < MIN_WIDTH) {
      w = MIN_WIDTH
    }
    _setWidth(w)
  }
  const isMobile = device === 'mobile'
  const onClickMenu = () => closeMenu()
  const clickSettings = () => openSettings()

  return (
    <Wrap className={className} style={{ width: isMobile ? MIN_WIDTH : width }}>
      <ResizerX
        style={{ display: isMobile ? 'none' : '' }}
        width={width}
        setWidth={setWidth}
      />
      <div className="wrapper">
        <header className="header">
          <Settings className="settings" onClick={clickSettings} />
          <div className="space"></div>
          <MobileMenuIcon onClick={onClickMenu} />
        </header>
        <SearchInput />
        <div className="contents">
          <RoomNavi />
          {rooms}
        </div>
      </div>
    </Wrap>
  )
}

const Wrap = styled.div`
  max-width: 50%;
  min-width: 300px;
  height: 100%;
  display: flex;

  > .wrapper {
    flex: 1;
    color: var(--color-on-surface);
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .header {
    height: var(--header-height);
    display: flex;
    justify-content: flex-end;
    align-items: center;
    display: none;
  }

  .contents {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  &.open {
    transform: translate3d(0, 0, 0);
  }

  @media (max-width: ${WIDTH_MOBILE}px) {
    background: var(--color-background);
    width: var(--mobile-menu-width);
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    transform: translate3d(100%, 0, 0);
    transition-duration: 0.3s;
    z-index: var(--z-index-on-overlay);

    .header {
      display: flex;
      border-bottom: 1px solid var(--color-border);
      .space {
        flex: 1;
      }
      .settings {
        padding: 8px;
      }
    }
  }
`
