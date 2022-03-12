import React, { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useApp } from './App.hooks'
import { useUser } from './contexts/user/hooks'

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const url = `${protocol}//${window.location.host}/socket`

const WithSuspense: React.FC = ({ children }) => {
  return <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
}

const Init = React.memo(() => {
  useApp(url)
  return <></>
})

const App = () => {
  const { login } = useUser()
  const Top = login
    ? lazy(() => import('./pages/Top'))
    : lazy(() => import('./pages/Login'))
  const Room = login
    ? lazy(() => import('./pages/Room'))
    : lazy(() => import('./pages/Login'))

  const PageTos = lazy(() => import('./pages/Tos'))
  const PagePrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
  const LoginSuccess = lazy(() => import('./pages/LoginSuccess'))

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <WithSuspense>
              <Top />
            </WithSuspense>
          }
        />
        <Route path="/rooms">
          <Route
            path=":name"
            element={
              <WithSuspense>
                <Room />
              </WithSuspense>
            }
          />
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
      <Init />
    </>
  )
}
export default App
