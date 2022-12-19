import React, { Suspense, lazy, PropsWithChildren } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useApp } from './App.hooks'
import { useAuth } from './recoil/auth/hooks'
import { Loading } from './components/Loading'

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const url = `${protocol}//${window.location.host}/socket`

const WithSuspense: React.FC<PropsWithChildren<unknown>> = ({ children }) => {
  return <Suspense fallback={<Loading />}>{children}</Suspense>
}

const App = () => {
  useApp(url)
  const { login } = useAuth()
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
    </>
  )
}
export default App
