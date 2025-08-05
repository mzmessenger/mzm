import { StrictMode } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import 'normalize.css'
import 'highlight.js/styles/base16/onedark.css'
import './index.css'
import DuckDBProvider from './state/duckdb/Provider'
import App from './App'
import Top from './pages/Top'
import Room from './pages/Room'
import Tos from './pages/Tos'
import PrivacyPolicy from './pages/PrivacyPolicy'
import LoginSuccess from './pages/LoginSuccess'

const root = createRoot(document.getElementById('root'))

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        path: '/',
        element: <Top />
      },
      {
        path: '/rooms/:name',
        element: <Room />
      },
      {
        path: '/tos',
        element: <Tos />
      },
      {
        path: '/privacy-policy',
        element: <PrivacyPolicy />
      },
      {
        path: '/login/success',
        element: <LoginSuccess />
      }
    ]
  }
])

root.render(
  <StrictMode>
    <DuckDBProvider>
      <RouterProvider router={router} />
    </DuckDBProvider>
  </StrictMode>
)

const updateSW = registerSW({
  onNeedRefresh() {
    const result = window.confirm(
      '新しいバージョンのクライアントが見つかりました。キャッシュを更新します。'
    )
    if (result) {
      updateSW()
    }
  },
  onRegistered(r) {
    if (r) {
      setInterval(
        () => {
          r.update()
        },
        60 * 60 * 1000
      )
    }
  }
})
