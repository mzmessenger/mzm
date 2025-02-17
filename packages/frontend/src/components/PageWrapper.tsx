import React, { type PropsWithChildren, type FC, type ReactNode } from 'react'
import styled from '@emotion/styled'
import { useUiActions, useMenuUi } from '../state/ui/hooks'
import { WIDTH_MOBILE } from '../constants'
export { Header } from './Header'

type Props = {
  header: ReactNode
}

export const PageWrapper: FC<PropsWithChildren<Props>> = ({
  children,
  header
}) => {
  const { overlay, menuStatus } = useMenuUi()
  const { closeMenu } = useUiActions()
  const classNames = menuStatus === 'open' ? ['body open'] : ['body']

  return (
    <Wrap>
      {header}
      <div className={classNames.join(' ')}>{children}</div>
      {overlay && <div className="overlay" onClick={() => closeMenu()} />}
    </Wrap>
  )
}

const Wrap = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  container-name: page-container;
  container-type: inline-size;

  .overlay {
    position: fixed;
    right: 0px;
    bottom: 0px;
    top: 0px;
    left: 0px;
    background-color: hsl(0, 0%, 7%);
    opacity: 0.5;
    z-index: var(--z-index-overlay);
  }

  > .body {
    width: 100%;
    height: 100%;
    display: flex;
    overflow: hidden;
  }

  @container page-container (max-width: ${WIDTH_MOBILE}px) {
    .body {
      overflow: auto;
    }
  }
`
