import React, { lazy } from 'react'
import { useUi } from '../contexts/ui/hooks'
import { Menu } from '../components/Menu'
import { PageWrapper } from '../components/PageWrapper'
import { TopContent } from '../components/TopContent'

const Top = () => {
  const { isOpenSettings } = useUi()

  const Settings = lazy(() => import('../components/Settings'))

  return (
    <PageWrapper>
      {isOpenSettings ? (
        <Settings />
      ) : (
        <>
          <TopContent />
          <Menu />
        </>
      )}
    </PageWrapper>
  )
}
export default Top
