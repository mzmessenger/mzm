import React, { lazy } from 'react'
import { useUi } from '../../contexts/ui/hooks'
import Menu from '../atoms/Menu'
import RoomContent from '../RoomContent'
import PageWrapper from '../templates/PageWrapper'
import UserDetail from '../UserDetail'

const PageRoom = () => {
  const { isOpenSettings, isOpenUserDetail } = useUi()
  const Settings = lazy(() => import('../Settings'))

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
