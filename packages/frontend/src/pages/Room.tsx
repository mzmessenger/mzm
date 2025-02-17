import React, { lazy, Suspense } from 'react'
import { useSettingsUi } from '../state/ui/hooks'
import { useLoginFlag } from '../state/auth/hooks'
import { Menu, Rooms } from '../components/Menu'
import { RoomContent } from '../components/Room'
import { PageWrapper, Header } from '../components/PageWrapper'
import { ModalUserProfile } from '../components/ModalUserProfile'
import Login from './Login'

const PageRoom = () => {
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
          <RoomContent />
          <Menu rooms={<Rooms />} />
        </>
      )}
      <ModalUserProfile />
    </PageWrapper>
  )
}

export default PageRoom
