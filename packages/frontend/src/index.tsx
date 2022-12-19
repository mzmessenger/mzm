import React from 'react'
import { registerSW } from 'virtual:pwa-register'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import 'normalize.css'
import 'highlight.js/styles/base16/onedark.css'
import './index.css'
import { Provider as ContextProvider } from './contexts'
import App from './App'

const root = createRoot(document.getElementById('root'))

root.render(
  <RecoilRoot>
    <BrowserRouter>
      <ContextProvider>
        <App />
      </ContextProvider>
    </BrowserRouter>
  </RecoilRoot>
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
    r &&
      setInterval(() => {
        r.update()
      }, 60 * 60 * 1000)
  }
})
