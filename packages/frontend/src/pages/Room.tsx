import React, { lazy } from 'react'
import { useUi } from '../contexts/ui/hooks'
import { Menu } from '../components/Menu'
import { RoomContent } from '../components/Room'
import { PageWrapper } from '../components/PageWrapper'
import { ModalUserProfile } from '../components/ModalUserProfile'

const PageRoom = () => {
  const { isOpenSettings } = useUi()
  const Settings = lazy(() => import('../components/Settings'))

  return (
    <PageWrapper>
      {isOpenSettings ? (
        <Settings />
      ) : (
        <>
          <RoomContent />
          <Menu />
        </>
      )}
      <ModalUserProfile />
    </PageWrapper>
  )
}

export default PageRoom
