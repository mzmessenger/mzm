import React, { Suspense, lazy, PropsWithChildren } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useApp } from './App.hooks'
import { Loading } from './components/Loading'
import Top from './pages/Top'
import Room from './pages/Room'

const WithSuspense: React.FC<PropsWithChildren<unknown>> = ({ children }) => {
  return <Suspense fallback={<Loading />}>{children}</Suspense>
}

// reduce rerender app
const NoRenderApp = React.memo(() => {
  useApp()
  return <></>
})

const App = () => {
  const PageTos = lazy(() => import('./pages/Tos'))
  const PagePrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
  const LoginSuccess = lazy(() => import('./pages/LoginSuccess'))

  return (
    <>
      <Routes>
        <Route path="/" element={<Top />} />
        <Route path="/rooms">
          <Route path=":name" element={<Room />} />
        </Route>
        <Route
          path="/tos"
          element={
            <WithSuspense>
              <PageTos />
            </WithSuspense>
          }
        />
        <Route
          path="/privacy-policy"
          element={
            <WithSuspense>
              <PagePrivacyPolicy />
            </WithSuspense>
          }
        />
        <Route
          path="/login/success"
          element={
            <WithSuspense>
              <LoginSuccess />
            </WithSuspense>
          }
        />
      </Routes>
      <NoRenderApp />
    </>
  )
}
export default App
