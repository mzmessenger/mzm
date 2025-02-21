import React from 'react'
import styled from '@emotion/styled'
import { useUiActions } from '../../state/ui/hooks'
import { WIDTH_MOBILE } from '../../constants'
import { Link } from '../atoms/Link'
import { MobileMenuIcon } from '../atoms/MobileMenuIcon'
import { MyInfo } from './MyInfo'

type Props = {
  style?: React.CSSProperties
}

const HeaderInner: React.FC<Props> = ({ style }) => {
  const { openMenu } = useUiActions()

  const onClick = () => openMenu()

  return (
    <Wrap style={style}>
      <Link className="logo" to="/">
        <div>MZM</div>
      </Link>
      <div style={{ flex: 1 }}></div>
      <div className="profile">
        <MyInfo />
      </div>
      <MobileMenuIcon className="menu-icon" onClick={onClick} />
    </Wrap>
  )
}

export const Header = React.memo(HeaderInner)

const Wrap = styled.header`
  height: var(--header-height);
  padding: 0 16px;
  display: flex;
  align-items: center;
  color: var(--color-on-surface);
  border-bottom: 1px solid var(--color-border);
  .logo {
    display: flex;
    align-items: center;
    font-size: 16px;
    font-weight: 500;
  }

  .menu-icon {
    display: none;
  }

  & > a {
    display: flex;
    text-decoration: none;
    color: var(--color-on-surface);
  }

  @container page-container (max-width: ${WIDTH_MOBILE}px) {
    padding: 0 8px 0 16px;
    > .profile {
      display: none;
    }
    > .menu-icon {
      display: block;
    }
  }
`
