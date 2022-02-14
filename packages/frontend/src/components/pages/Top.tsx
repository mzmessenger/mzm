import React, { lazy } from 'react'
import { useUi } from '../../contexts/ui/hooks'
import Menu from '../atoms/Menu'
import PageWrapper from '../templates/PageWrapper'
import TopContent from '../TopContent'

const Top = () => {
  const { isOpenSettings } = useUi()

  const Settings = lazy(() => import('../Settings'))

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
