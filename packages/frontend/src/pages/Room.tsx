import React, { lazy } from 'react'
import { useUi } from '../contexts/ui/hooks'
import { Menu } from '../components/Menu'
import { RoomContent } from '../components/Room'
import { PageWrapper } from '../components/PageWrapper'
import { UserDetail } from '../components/UserDetail'

const PageRoom = () => {
  const { isOpenSettings, isOpenUserDetail } = useUi()
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
      {isOpenUserDetail && <UserDetail />}
    </PageWrapper>
  )
}

export default PageRoom
