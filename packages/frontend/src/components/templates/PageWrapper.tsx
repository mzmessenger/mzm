import React from 'react'
import styled from 'styled-components'
import { useUi } from '../../contexts/ui/hooks'
import { WIDTH_MOBILE } from '../../lib/constants'
import Header from '../atoms/Header'

const PageWrapper = ({ children }: { children?: React.ReactNode }) => {
  const { overlay, menuStatus } = useUi()
  const classNames = menuStatus === 'open' ? ['body open'] : ['body']

  return (
    <Wrap>
      <Header />
      <div className={classNames.join(' ')}>{children}</div>
      {overlay && <div className="overlay" />}
    </Wrap>
  )
}
export default PageWrapper

const Wrap = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;

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

  @media (max-width: ${WIDTH_MOBILE}px) {
    .body {
      overflow: auto;
    }
  }
`
