import React from 'react'
import { registerSW } from 'virtual:pwa-register'
import ReactDom from 'react-dom'
import { BrowserRouter } from 'react-router-dom'
import 'normalize.css'
import 'highlight.js/styles/base16/onedark.css'
import './index.css'
import { Provider as ContextProvider } from './contexts'
import App from './App'

ReactDom.render(
  <BrowserRouter>
    <ContextProvider>
      <App />
    </ContextProvider>
  </BrowserRouter>,
  document.getElementById('root')
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
