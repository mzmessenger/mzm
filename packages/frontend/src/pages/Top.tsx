import React, { lazy, Suspense } from 'react'
import { useSettingsUiState } from '../recoil/ui/hooks'
import { Menu } from '../components/Menu'
import { PageWrapper } from '../components/PageWrapper'
import { TopContent } from '../components/TopContent'

const Top = () => {
  const { isOpenSettings } = useSettingsUiState()

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
