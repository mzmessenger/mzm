import React, { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { State } from './modules/index'
import { onResize } from './modules/ui'
import Socket from './components/Socket'
import RouterListener from './components/RouterListener'

const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
const url = `${protocol}//${window.location.host}/socket`

const WithSuspense: React.FC = ({ children }) => {
  return <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>
}

const App = () => {
  const login = useSelector((state: State) => state.user.login)
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(onResize(window.innerWidth, window.innerHeight))

    const handleResize = () => {
      dispatch(onResize(window.innerWidth, window.innerHeight))
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const Top = login
    ? lazy(() => import('./components/pages/Top'))
    : lazy(() => import('./components/pages/Login'))
  const Room = login
    ? lazy(() => import('./components/pages/Room'))
    : lazy(() => import('./components/pages/Login'))

  const PageSignup = lazy(() => import('./components/pages/Signup'))
  const PageTos = lazy(() => import('./components/pages/Tos'))
  const PagePrivacyPolicy = lazy(
    () => import('./components/pages/PrivacyPolicy')
  )
  const LoginSuccess = lazy(() => import('./components/pages/LoginSuccess'))

  return (
    <BrowserRouter>
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
          path="/signup"
          element={
            <WithSuspense>
              <PageSignup />
            </WithSuspense>
          }
        />
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
      <RouterListener />
      <Socket url={url} />
    </BrowserRouter>
  )
}
export default App
