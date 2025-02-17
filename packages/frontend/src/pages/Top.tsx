import React, { lazy, Suspense } from 'react'
import { useSettingsUi } from '../state/ui/hooks'
import { useLoginFlag } from '../state/auth/hooks'
import { Menu, Rooms } from '../components/Menu'
import { PageWrapper, Header } from '../components/PageWrapper'
import { TopContent } from '../components/TopContent'
import Login from './Login'

const Top = () => {
  const login = useLoginFlag()
  const { isOpenSettings } = useSettingsUi()

  if (!login) {
    return <Login />
  }

  const Settings = lazy(() => import('../components/Settings'))

  return (
    <PageWrapper header={<Header />}>
      {isOpenSettings ? (
        <Suspense>
          <Settings />
        </Suspense>
      ) : (
        <>
          <TopContent />
          <Menu rooms={<Rooms />} />
        </>
      )}
    </PageWrapper>
  )
}
export default Top
