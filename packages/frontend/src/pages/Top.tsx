import React, { lazy, Suspense } from 'react'
import { useUi } from '../contexts/ui/hooks'
import { Menu } from '../components/Menu'
import { PageWrapper } from '../components/PageWrapper'
import { TopContent } from '../components/TopContent'
// import Settings from '../components/Settings'

const Top = () => {
  const { isOpenSettings } = useUi()

  const Settings = lazy(() => import('../components/Settings'))

  return (
    <PageWrapper>
      {isOpenSettings ? (
        <Suspense>
          <Settings />
        </Suspense>
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
