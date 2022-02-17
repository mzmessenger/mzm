import React from 'react'
import styled from '@emotion/styled'
import { useUi, useDispatchUi } from '../../contexts/ui/hooks'
import { WIDTH_MOBILE } from '../../lib/constants'
import { Link } from '../atoms/Link'
import { MobileMenuIcon } from '../atoms/MobileMenuIcon'
import { MyInfo } from './MyInfo'

type Props = {
  style?: React.CSSProperties
}

export const Header: React.FC<Props> = ({ style }) => {
  const { device } = useUi()
  const { openMenu } = useDispatchUi()

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
      {device === 'mobile' && <MobileMenuIcon onClick={onClick} />}
    </Wrap>
  )
}

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

  & > a {
    display: flex;
    text-decoration: none;
    color: var(--color-on-surface);
  }

  @media (max-width: ${WIDTH_MOBILE}px) {
    padding: 0 8px 0 16px;
    > .profile {
      display: none;
    }
  }
`